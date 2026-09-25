import { z } from "zod";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { normalizeSubcategory } from "@/lib/money";
import { applyTxDelta, computeMonthKey, getSettings } from "@/lib/moneyEngine";
import { MONEY_MODES, MONEY_TX_TYPES, type MoneyCategory, type MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

const LIST_LIMIT = 50;

/** GET /api/money/tx?month=&category=&type=&tag=&q=&cursor= */
export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const category = url.searchParams.get("category");
    const type = url.searchParams.get("type");
    const tag = url.searchParams.get("tag");
    const q = url.searchParams.get("q")?.trim().toLowerCase();
    const cursor = url.searchParams.get("cursor");

    let query = db().collection("money_tx") as FirebaseFirestore.Query;
    if (month) query = query.where("monthKey", "==", month);
    if (category) query = query.where("categoryId", "==", category);
    query = query.orderBy("date", "desc").orderBy("createdAt", "desc").limit(LIST_LIMIT + 1);
    if (cursor) {
      const cursorSnap = await db().collection("money_tx").doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }

    const snap = await query.get();
    const hasMore = snap.docs.length > LIST_LIMIT;
    let items = snap.docs.slice(0, LIST_LIMIT).map((d) => d.data() as MoneyTx);
    // Firestore can't combine array-contains, a text match, or a `type` equality
    // filter with the composite date/monthKey/category query above without a
    // combinatorial explosion of indexes — filtered in-memory instead, which is
    // fine at a personal-library transaction count (and callers needing this
    // always pair it with a month filter, which already bounds the result set).
    if (type) items = items.filter((tx) => tx.type === type);
    if (tag) items = items.filter((tx) => tx.tags?.includes(tag));
    if (q) items = items.filter((tx) => tx.note?.toLowerCase().includes(q) || tx.subcategory?.toLowerCase().includes(q));

    return ok({ items, nextCursor: hasMore ? snap.docs[LIST_LIMIT - 1].id : null });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  type: z.enum(MONEY_TX_TYPES),
  amountPaise: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().min(1),
  subcategory: z.string().max(60).optional(),
  tripId: z.string().min(1).max(60).optional(),
  note: z.string().max(300).default(""),
  mode: z.enum(MONEY_MODES).optional(),
  cardId: z.string().optional(),
  paidBy: z.string().email().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).default([]),
  recurringId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await req.json());

    const catSnap = await db().collection("money_categories").doc(body.categoryId).get();
    if (!catSnap.exists) throw new Error("Unknown category");
    const category = catSnap.data() as MoneyCategory;
    const subcategory = normalizeSubcategory(body.subcategory, category.subcategories);
    if (!subcategory) throw new Error("Pick or type a sub-category");
    if (body.tripId && !(await db().collection("trips").doc(body.tripId).get()).exists) throw new Error("That trip no longer exists");

    const settings = await getSettings();
    const monthKey = computeMonthKey(body.date, settings.monthStartDay);

    const txRef = db().collection("money_tx").doc();
    const now = Date.now();
    const tx: MoneyTx = {
      id: txRef.id,
      type: body.type,
      amountPaise: body.amountPaise,
      date: body.date,
      monthKey,
      categoryId: body.categoryId,
      subcategory,
      ...(body.tripId ? { tripId: body.tripId } : {}),
      note: body.note,
      mode: body.mode,
      cardId: body.cardId,
      paidBy: body.paidBy ?? user.email,
      tags: body.tags,
      source: body.recurringId ? "recurring" : "manual",
      recurringId: body.recurringId,
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
    };

    await db().runTransaction(async (t) => {
      // Reads (inside applyTxDelta) must finish before any writes — the tx
      // doc's own write comes after, not before, that call.
      await applyTxDelta(t, monthKey, { type: tx.type, amountPaise: tx.amountPaise, group: category.group, categoryId: tx.categoryId, mode: tx.mode }, 1);
      t.set(txRef, tx);
      if (subcategory && !category.subcategories?.includes(subcategory)) {
        t.set(catSnap.ref, { subcategories: FieldValue.arrayUnion(subcategory) }, { merge: true });
      }
    });

    return ok({ tx });
  } catch (e) {
    return fail(e);
  }
}
