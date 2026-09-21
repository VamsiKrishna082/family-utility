import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(60).optional(),
  regNumber: z.string().max(20).optional(),
  logs: z
    .array(
      z.object({
        id: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.enum(["fuel", "service"]),
        odometer: z.number().nonnegative().nullable(),
        amount: z.number().nonnegative(),
        notes: z.string().max(200),
      }),
    )
    .optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    await db().collection("vehicles").doc(id).set(body, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("vehicles").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
