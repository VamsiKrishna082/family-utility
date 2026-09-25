import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { addDays, budgetBucket } from "@/lib/trips/logic";
import { getTrip, toTripExpense } from "@/lib/trips/store";
import type { MoneyCategory, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET — Money expenses that look like they belong to this trip and aren't on
 * any trip yet: anything dated during the trip, plus travel and stay
 * expenses from 45 days before to 7 days after (tickets, hotel advances).
 * One date-range query; the rest is filtered here.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.startDate || !trip.endDate) return ok({ items: [] });
    const from = addDays(trip.startDate, -45);
    const to = addDays(trip.endDate, 7);
    const [txSnap, catSnap] = await Promise.all([
      db().collection("money_tx").where("date", ">=", from).where("date", "<=", to).get(),
      db().collection("money_categories").get(),
    ]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
    const items = txSnap.docs
      .map((d) => d.data() as MoneyTx)
      .filter((t) => t.type === "expense" && !t.tripId)
      .map((t) => {
        const e = toTripExpense(t, cats);
        const during = t.date >= trip.startDate! && t.date <= trip.endDate!;
        const bucket = budgetBucket(e.categoryGroup, e.categoryName);
        const reason = during ? "during the trip" : bucket === "travel" || bucket === "stay" ? `${bucket} booking` : null;
        return reason ? { ...e, reason } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}
