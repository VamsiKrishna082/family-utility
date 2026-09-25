import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { budgetBucket, headCount } from "@/lib/trips/logic";
import { getTrip, HttpError, tripExpenses } from "@/lib/trips/store";
import type { BudgetKey, Trip } from "@/lib/trips/types";

export const runtime = "nodejs";

async function summary(t: Trip) {
  const { items, refunds } = await tripExpenses(t.id);
  const byBucket: Partial<Record<BudgetKey, number>> = {};
  for (const e of items) {
    const k = budgetBucket(e.categoryGroup, e.categoryName);
    byBucket[k] = (byBucket[k] ?? 0) + e.amountPaise / 100;
  }
  const total = (items.reduce((s, e) => s + e.amountPaise, 0) - refunds.reduce((s, e) => s + e.amountPaise, 0)) / 100;
  const heads = headCount(t.travellers);
  return { id: t.id, name: t.name, startDate: t.startDate ?? null, days: t.days, heads, total, perPerson: total / heads, perPersonPerDay: total / heads / t.days, byBucket };
}

/** GET ?with=<otherTripId> — both trips side by side: net total, per person, per person per day, by budget bucket. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const other = new URL(req.url).searchParams.get("with");
    if (!other || other === id) throw new HttpError("Pick another trip to compare with");
    const [a, b] = await Promise.all([getTrip(id), getTrip(other)]);
    return ok({ a: await summary(a), b: await summary(b) });
  } catch (e) {
    return fail(e);
  }
}
