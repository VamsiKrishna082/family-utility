import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { getTrip, HttpError, toTripExpense } from "@/lib/trips/store";
import type { MoneyCategory, MoneyTx } from "@/lib/types";
import type { TripCandidateMonth } from "@/lib/trips/types";

export const runtime = "nodejs";

/**
 * Money expenses you can link to this trip, organised the way Money itself
 * is — by Money's month (monthKey, which follows the month start day), then
 * category:
 *   GET            → { months: [{ monthKey, count, totalPaise }] }  newest first
 *   GET ?month=MK  → { items } every expense in that Money month
 * Expenses already on this trip are left out; ones on another trip are
 * included and flagged (linking moves them here). Single-field queries only,
 * so no composite index is needed.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const month = new URL(req.url).searchParams.get("month");
    const col = db().collection("money_tx");

    if (!month) {
      const snap = await col.where("type", "==", "expense").select("monthKey", "amountPaise", "tripId").get();
      const byMonth = new Map<string, TripCandidateMonth>();
      for (const d of snap.docs) {
        const t = d.data() as Pick<MoneyTx, "monthKey" | "amountPaise" | "tripId">;
        if (t.tripId === id || !t.monthKey) continue;
        const m = byMonth.get(t.monthKey) ?? { monthKey: t.monthKey, count: 0, totalPaise: 0 };
        m.count += 1;
        m.totalPaise += t.amountPaise;
        byMonth.set(t.monthKey, m);
      }
      return ok({ months: [...byMonth.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey)) });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError("Bad month");
    const [txSnap, catSnap] = await Promise.all([col.where("monthKey", "==", month).get(), db().collection("money_categories").get()]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
    const items = txSnap.docs
      .map((d) => d.data() as MoneyTx)
      .filter((t) => t.type === "expense" && t.tripId !== id)
      .map((t) => ({ ...toTripExpense(t, cats), ...(t.tripId ? { otherTripId: t.tripId } : {}) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return ok({ items, month });
  } catch (e) {
    return fail(e);
  }
}
