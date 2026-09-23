import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  order: z.number().int().optional(),
  archived: z.boolean().optional(),
});

/** Rename, reorder or archive — no delete, so archived categories keep their history intact on past transactions. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    await db().collection("money_categories").doc(id).set(patch, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
