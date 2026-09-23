import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { NW_ASSET_CLASSES, NW_AUTO_PRICE, NW_HELD_BY } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  assetClass: z.enum(NW_ASSET_CLASSES).optional(),
  institution: z.string().trim().max(80).optional(),
  heldBy: z.enum(NW_HELD_BY).optional(),
  liquid: z.boolean().optional(),
  autoPrice: z.enum(NW_AUTO_PRICE).optional(),
  quantity: z.number().positive().optional(),
  navCode: z.string().trim().max(30).optional(),
  investedPaise: z.number().int().positive().optional(),
  loan: z.object({ emiPaise: z.number().int().positive(), ratePct: z.number().positive(), endDate: z.string() }).optional(),
  linkedToMoneyLeftover: z.boolean().optional(),
  linkedToMoneyGoalId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

/** Rename, retarget, or archive (soft-delete, still visible for unarchiving). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    await db().collection("nw_accounts").doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Hard delete — safe to do, unlike Money's categories: an old nw_snapshot's
 * values[accountId] for a since-deleted account just resolves to undefined
 * in computeTotals()'s account lookup and is silently skipped, not double
 * counted or crashed on. That historical number simply stops being
 * attributed to anything once the account is gone, same as it would with
 * archive — the difference is only whether the account itself still shows
 * up anywhere to unarchive.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("nw_accounts").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
