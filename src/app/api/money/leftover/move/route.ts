import { z } from "zod";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { applyTxDelta, computeMonthKey, getSettings } from "@/lib/moneyEngine";
import type { MoneyCategory, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  amountPaise: z.number().int().positive(),
  categoryId: z.string().min(1),
  /** When set, also credits this amount toward a Goal's progress — used by both the dashboard's "move leftover" card and the Goals card's own "+ Add" button, which are otherwise identical (log a saving transaction). */
  goalId: z.string().optional(),
});

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** POST /api/money/leftover/move — logs a saving transaction, optionally crediting a Goal. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { amountPaise, categoryId, goalId } = Body.parse(await req.json());

    const catSnap = await db().collection("money_categories").doc(categoryId).get();
    if (!catSnap.exists) throw new Error("Unknown category");
    const category = catSnap.data() as MoneyCategory;
    if (category.type !== "saving") throw new Error("That category isn't a saving target");

    const settings = await getSettings();
    const date = todayInIndia();
    const monthKey = computeMonthKey(date, settings.monthStartDay);

    const txRef = db().collection("money_tx").doc();
    const now = Date.now();
    const tx: MoneyTx = {
      id: txRef.id, type: "saving", amountPaise, date, monthKey, categoryId,
      note: goalId ? "Contribution to goal" : "Moved from leftover", tags: [], source: "manual",
      paidBy: user.email, createdBy: user.email, createdAt: now, updatedAt: now,
    };

    await db().runTransaction(async (t) => {
      await applyTxDelta(t, monthKey, { type: "saving", amountPaise, group: category.group, categoryId, mode: undefined }, 1);
      t.set(txRef, tx);
      if (goalId) t.set(db().collection("money_goals").doc(goalId), { savedPaise: FieldValue.increment(amountPaise), updatedAt: now }, { merge: true });
    });

    return ok({ tx });
  } catch (e) {
    return fail(e);
  }
}
