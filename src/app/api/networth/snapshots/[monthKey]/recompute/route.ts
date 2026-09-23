import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { recomputeSnapshot } from "@/lib/networthEngine";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ monthKey: string }> }) {
  try {
    await requireUser();
    const { monthKey } = await ctx.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Bad monthKey");
    return ok({ snapshot: await recomputeSnapshot(monthKey) });
  } catch (e) {
    return fail(e);
  }
}
