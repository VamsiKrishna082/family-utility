import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { getTrip, tripExpenses } from "@/lib/trips/store";

export const runtime = "nodejs";

/** GET — every Money expense linked to this trip, from any month. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    return ok({ items: await tripExpenses(id) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({ txIds: z.array(z.string().min(1)).min(1).max(200), link: z.boolean() });

/**
 * POST { txIds, link } — link existing Money expenses to this trip, or unlink
 * them. Only the tripId tag changes; amounts, months and Money's own totals
 * are untouched.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const { txIds, link } = Body.parse(await req.json());
    const refs = txIds.map((t) => db().collection("money_tx").doc(t));
    const snaps = await db().getAll(...refs);
    const batch = db().batch();
    let changed = 0;
    for (const s of snaps) {
      if (!s.exists) continue;
      const tx = s.data()!;
      if (link) {
        batch.update(s.ref, { tripId: id });
        changed++;
      } else if (tx.tripId === id) {
        batch.update(s.ref, { tripId: FieldValue.delete() });
        changed++;
      }
    }
    await batch.commit();
    return ok({ changed });
  } catch (e) {
    return fail(e);
  }
}
