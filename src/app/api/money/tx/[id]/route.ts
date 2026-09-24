import { z } from "zod";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { normalizeSubcategory } from "@/lib/money";
import { applyMonthDeltas, applyTxDelta, applyTxDeltas, computeMonthKey, getSettings, type TxDeltaInput } from "@/lib/moneyEngine";
import { MONEY_MODES, MONEY_TX_TYPES, type MoneyCategory, type MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  type: z.enum(MONEY_TX_TYPES).optional(),
  amountPaise: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().min(1).optional(),
  /** null clears it; omitted keeps the current one unless the category changed (a sub-category belongs to its category). */
  subcategory: z.string().max(60).nullable().optional(),
  note: z.string().max(300).optional(),
  mode: z.enum(MONEY_MODES).optional(),
  cardId: z.string().nullable().optional(),
  paidBy: z.string().email().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).optional(),
});

/**
 * Reads the old tx and both its old and (if changed) new category up front,
 * then applies -1 of the old values and +1 of the new — one applyTxDeltas
 * call if the edit stays within the same month, two applyMonthDeltas plans
 * if the date moved the tx into a different month. Every read here happens
 * before the tx doc's own write, and before any of applyMonthDeltas's writes,
 * to satisfy Firestore's all-reads-before-all-writes transaction rule.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());

    const settings = patch.date ? await getSettings() : null;
    const txRef = db().collection("money_tx").doc(id);

    await db().runTransaction(async (t) => {
      const oldSnap = await t.get(txRef);
      if (!oldSnap.exists) throw new Error("Transaction not found");
      const oldTx = oldSnap.data() as MoneyTx;

      const newCategoryId = patch.categoryId ?? oldTx.categoryId;
      const categoryChanged = newCategoryId !== oldTx.categoryId;
      const [oldCatSnap, newCatSnap] = await Promise.all([
        t.get(db().collection("money_categories").doc(oldTx.categoryId)),
        categoryChanged ? t.get(db().collection("money_categories").doc(newCategoryId)) : Promise.resolve(null),
      ]);
      // A goal contribution moves the goal's total with it: read the goal now, before any write.
      const goalSnap = oldTx.goalId ? await t.get(db().collection("money_goals").doc(oldTx.goalId)) : null;
      const oldGroup = (oldCatSnap.data() as MoneyCategory | undefined)?.group ?? "Miscellaneous";
      const newGroup = categoryChanged ? ((newCatSnap!.data() as MoneyCategory | undefined)?.group ?? "Miscellaneous") : oldGroup;
      const newCatSnapResolved = categoryChanged ? newCatSnap! : oldCatSnap;
      const newCatSubs = (newCatSnapResolved.data() as MoneyCategory | undefined)?.subcategories ?? [];
      const subcategory = patch.subcategory === null
        ? undefined
        : patch.subcategory !== undefined
          ? normalizeSubcategory(patch.subcategory, newCatSubs)
          : categoryChanged ? undefined : oldTx.subcategory;
      // Required going forward, but only enforced when an edit touches it, so fixing
      // e.g. the amount on an older entry that predates sub-categories still works.
      if ((patch.subcategory !== undefined || categoryChanged) && !subcategory) throw new Error("Pick or type a sub-category");

      const newTx: MoneyTx = {
        ...oldTx,
        type: patch.type ?? oldTx.type,
        amountPaise: patch.amountPaise ?? oldTx.amountPaise,
        date: patch.date ?? oldTx.date,
        categoryId: newCategoryId,
        subcategory,
        note: patch.note ?? oldTx.note,
        mode: patch.mode ?? oldTx.mode,
        cardId: patch.cardId === null ? undefined : (patch.cardId ?? oldTx.cardId),
        paidBy: patch.paidBy ?? oldTx.paidBy,
        tags: patch.tags ?? oldTx.tags,
        updatedAt: Date.now(),
      };
      newTx.monthKey = patch.date ? computeMonthKey(patch.date, settings!.monthStartDay) : oldTx.monthKey;

      const oldInput: TxDeltaInput = { type: oldTx.type, amountPaise: oldTx.amountPaise, group: oldGroup, categoryId: oldTx.categoryId, mode: oldTx.mode };
      const newInput: TxDeltaInput = { type: newTx.type, amountPaise: newTx.amountPaise, group: newGroup, categoryId: newTx.categoryId, mode: newTx.mode };

      if (oldTx.monthKey === newTx.monthKey) {
        await applyTxDeltas(t, oldTx.monthKey, [{ input: oldInput, sign: -1 }, { input: newInput, sign: 1 }]);
      } else {
        await applyMonthDeltas(t, [
          { monthKey: oldTx.monthKey, ops: [{ input: oldInput, sign: -1 }] },
          { monthKey: newTx.monthKey, ops: [{ input: newInput, sign: 1 }] },
        ]);
      }

      t.set(txRef, newTx);
      if (goalSnap?.exists) {
        const counted = (tx: MoneyTx) => (tx.type === "saving" ? tx.amountPaise : 0);
        const delta = counted(newTx) - counted(oldTx);
        if (delta !== 0) t.update(goalSnap.ref, { savedPaise: FieldValue.increment(delta), updatedAt: Date.now() });
      }
      if (subcategory && newCatSnapResolved.exists && !newCatSubs.includes(subcategory)) {
        t.set(newCatSnapResolved.ref, { subcategories: FieldValue.arrayUnion(subcategory) }, { merge: true });
      }
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const txRef = db().collection("money_tx").doc(id);

    await db().runTransaction(async (t) => {
      const snap = await t.get(txRef);
      if (!snap.exists) return; // already gone — deleting twice is a no-op, not an error
      const tx = snap.data() as MoneyTx;
      const catSnap = await t.get(db().collection("money_categories").doc(tx.categoryId));
      const group = (catSnap.data() as MoneyCategory | undefined)?.group ?? "Miscellaneous";
      const goalSnap = tx.goalId ? await t.get(db().collection("money_goals").doc(tx.goalId)) : null;

      await applyTxDelta(t, tx.monthKey, { type: tx.type, amountPaise: tx.amountPaise, group, categoryId: tx.categoryId, mode: tx.mode }, -1);
      t.delete(txRef);
      // Deleting a goal contribution takes it back off the goal.
      if (goalSnap?.exists && tx.type === "saving") {
        t.update(goalSnap.ref, { savedPaise: FieldValue.increment(-tx.amountPaise), updatedAt: Date.now() });
      }
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
