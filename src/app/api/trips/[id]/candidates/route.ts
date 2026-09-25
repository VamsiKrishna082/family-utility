import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { candidateWindow } from "@/lib/trips/logic";
import { getTrip, toTripExpense } from "@/lib/trips/store";
import type { MoneyCategory, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET — Money expenses you might want to link: everything from 3 months
 * before the trip to 1 month after (bookings and shopping happen early), not
 * already on this trip. Ones on a different trip are included but flagged.
 * A single range filter on `date`, so no composite index is needed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.startDate || !trip.endDate) return ok({ items: [], from: "", to: "" });
    const { from, to } = candidateWindow(trip.startDate, trip.endDate);
    const [txSnap, catSnap] = await Promise.all([
      db().collection("money_tx").where("date", ">=", from).where("date", "<=", to).get(),
      db().collection("money_categories").get(),
    ]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
    const items = txSnap.docs
      .map((d) => d.data() as MoneyTx)
      .filter((t) => t.type === "expense" && t.tripId !== id)
      .map((t) => ({ ...toTripExpense(t, cats), ...(t.tripId ? { otherTripId: t.tripId } : {}) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    return ok({ items, from, to });
  } catch (e) {
    return fail(e);
  }
}
