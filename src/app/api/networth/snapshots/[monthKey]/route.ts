import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { saveSnapshotValues } from "@/lib/networthEngine";

export const runtime = "nodejs";

const Body = z.record(z.string(), z.number().int());

/** PUT /api/networth/snapshots/:monthKey — body { accountId: paise, ... }, partial: rows you don't include keep their existing value. */
export async function PUT(req: Request, ctx: { params: Promise<{ monthKey: string }> }) {
  try {
    const user = await requireUser();
    const { monthKey } = await ctx.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Bad monthKey");
    const values = Body.parse(await req.json());
    const snapshot = await saveSnapshotValues(monthKey, values, user.email);
    return ok({ snapshot });
  } catch (e) {
    return fail(e);
  }
}
