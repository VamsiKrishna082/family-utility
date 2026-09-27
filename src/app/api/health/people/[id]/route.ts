import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

/**
 * DELETE — remove a family member. Refused while they still have records
 * (medicines, visits, tests, vaccines), so nothing is deleted by accident;
 * delete those first. Their health details go with them.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const ref = db().collection("health_people").doc(id);
    if (!(await ref.get()).exists) throw new Error("Only family members you added can be removed");
    const items = await db().collection("health_items").where("person", "==", id).get();
    if (!items.empty) throw new Error(`They still have ${items.size} record${items.size === 1 ? "" : "s"} — delete those first`);
    await Promise.all([ref.delete(), db().collection("health_profiles").doc(id).delete()]);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
