import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { HealthFields } from "@/lib/healthSchema";

export const runtime = "nodejs";

const Patch = HealthFields.omit({ person: true }).partial().extend({
  // null clears an optional field (e.g. no next date any more)
  nextDate: HealthFields.shape.nextDate.nullable(),
  everyDays: HealthFields.shape.everyDays.nullable(),
  date: HealthFields.shape.date.nullable(),
});

/** PATCH — edit an item (null clears date / next date / repeat). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Patch.parse(await req.json());
    const update: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    for (const k of ["nextDate", "everyDays", "date"] as const) if (patch[k] === null) update[k] = FieldValue.delete();
    await db().collection("health_items").doc(id).update(update);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("health_items").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
