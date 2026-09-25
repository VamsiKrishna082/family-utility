import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { getTrip, HttpError, toTripExpense } from "@/lib/trips/store";
import type { MoneyCategory, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET ?month=YYYY-MM|all&category=<id>|"" — Money expenses you can link to
 * this trip, from any month and any category (bookings and shopping can be
 * months apart from the trip itself). Each combination is a single-field
 * query (category, or a date range for the month), so no composite index is
 * needed. Expenses already on this trip are left out; ones on another trip
 * are included and flagged (linking moves them here).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const url = new URL(req.url);
    const month = url.searchParams.get("month") ?? "all";
    const category = url.searchParams.get("category") ?? "";
    if (month !== "all" && !/^\d{4}-\d{2}$/.test(month)) throw new HttpError("Bad month");

    const col = db().collection("money_tx");
    const query = category
      ? col.where("categoryId", "==", category)
      : month !== "all"
        ? col.where("date", ">=", `${month}-01`).where("date", "<=", `${month}-31`)
        : col;

    const [txSnap, catSnap] = await Promise.all([query.get(), db().collection("money_categories").get()]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
    const items = txSnap.docs
      .map((d) => d.data() as MoneyTx)
      .filter((t) => t.type === "expense" && t.tripId !== id && (month === "all" || t.date.startsWith(month)))
      .map((t) => ({ ...toTripExpense(t, cats), ...(t.tripId ? { otherTripId: t.tripId } : {}) }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 500);
    return ok({ items, month, category });
  } catch (e) {
    return fail(e);
  }
}
