import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
export const runtime = "nodejs";

const Body = z.object({
  accountId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  karat: z.union([z.literal(24), z.literal(22), z.literal(18)]).optional(),
  grams: z.number().positive().optional(),
  // null clears the field (FieldValue.delete()) — e.g. an old item with no
  // known buy price, or removing a manual value override to go back to the
  // live-rate computation.
  buyPricePaise: z.number().int().positive().nullable().optional(),
  buyDate: z.string().min(1).optional(),
  manualValuePaise: z.number().int().positive().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    const firestorePatch: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    if (patch.buyPricePaise === null) firestorePatch.buyPricePaise = FieldValue.delete();
    if (patch.manualValuePaise === null) firestorePatch.manualValuePaise = FieldValue.delete();
    await db().collection("nw_gold_items").doc(id).set(firestorePatch, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("nw_gold_items").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
