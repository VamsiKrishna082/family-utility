import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  last4: z.string().trim().regex(/^\d{4}$/).optional(),
  archived: z.boolean().optional(),
});

/** Rename or archive only — no hard delete, since past transactions keep referencing this card's id for their spent/paid history. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    await db().collection("money_cards").doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
