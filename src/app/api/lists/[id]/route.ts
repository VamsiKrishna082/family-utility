import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(60).optional(),
  items: z
    .array(z.object({ id: z.string(), text: z.string().min(1).max(140), done: z.boolean() }))
    .optional(),
});

/** Client sends the whole `items` array back on every change — lists are small, this stays simple. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    await db()
      .collection("lists")
      .doc(id)
      .set({ ...body, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("lists").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
