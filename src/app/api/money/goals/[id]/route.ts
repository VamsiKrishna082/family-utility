import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  targetPaise: z.number().int().positive().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    await db().collection("money_goals").doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("money_goals").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
