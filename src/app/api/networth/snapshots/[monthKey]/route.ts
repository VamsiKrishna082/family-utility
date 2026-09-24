import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { computeAutoValues, currentMonthKey, getAccounts, saveSnapshotValues, syncAutoValues } from "@/lib/networthEngine";

export const runtime = "nodejs";

const Body = z.record(z.string(), z.number().int());

/** PUT /api/networth/snapshots/:monthKey — body { accountId: paise, ... }, partial: rows you don't include keep their existing value. */
export async function PUT(req: Request, ctx: { params: Promise<{ monthKey: string }> }) {
  try {
    const user = await requireUser();
    const { monthKey } = await ctx.params;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Bad monthKey");
    const values = Body.parse(await req.json());
    // Automatic accounts can't be typed over for the current month — their value always comes from the source.
    if (monthKey === currentMonthKey()) {
      const auto = await computeAutoValues(await getAccounts(), monthKey);
      for (const id of auto.keys()) delete values[id];
    }
    const snapshot = await saveSnapshotValues(monthKey, values, user.email);
    await syncAutoValues(monthKey);
    return ok({ snapshot });
  } catch (e) {
    return fail(e);
  }
}
