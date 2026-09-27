import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { HealthItem } from "@/lib/health";
import { HealthFields } from "@/lib/healthSchema";
import { healthPerson } from "@/lib/healthPeople";

export const runtime = "nodejs";


/** POST — add a visit, medicine, test or vaccine. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = HealthFields.parse(await req.json());
    if (!(await healthPerson(body.person))) throw new Error("Unknown person");
    const ref = db().collection("health_items").doc();
    const now = Date.now();
    const item = { ...body, id: ref.id, createdBy: user.email, createdAt: now, updatedAt: now } as HealthItem;
    if (item.kind === "medicine" && item.active === undefined) item.active = true;
    await ref.set(item);
    return ok({ item });
  } catch (e) {
    return fail(e);
  }
}
