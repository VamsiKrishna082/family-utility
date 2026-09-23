import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { recomputeMonth } from "@/lib/moneyEngine";

export const runtime = "nodejs";

/** POST /api/money/months/:monthKey/recompute — rebuilds a month's summary from its raw transactions. Repair tool, not part of normal traffic. */
export async function POST(_req: Request, ctx: { params: Promise<{ monthKey: string }> }) {
  try {
    await requireUser();
    const { monthKey } = await ctx.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Bad monthKey");
    const summary = await recomputeMonth(monthKey);
    return ok({ summary });
  } catch (e) {
    return fail(e);
  }
}
