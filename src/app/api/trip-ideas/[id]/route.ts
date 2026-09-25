import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { IdeaFields } from "@/lib/trips/ideas";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = IdeaFields.partial().parse(await req.json());
    await db().collection("trip_ideas").doc(id).update({ ...patch, updatedAt: Date.now() });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE — also used after an idea is turned into a real trip. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("trip_ideas").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
