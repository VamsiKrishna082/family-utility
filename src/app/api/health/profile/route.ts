import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { BLOOD_GROUPS, HEALTH_PEOPLE, type HealthProfile } from "@/lib/health";

export const runtime = "nodejs";

const Body = z.object({
  person: z.enum(HEALTH_PEOPLE.map((p) => p.id) as [string, ...string[]]),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable().optional(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(30),
  conditions: z.array(z.string().trim().min(1).max(80)).max(30),
  notes: z.string().trim().max(2000).optional(),
});

/** PUT — blood group, allergies, conditions and notes for one person. */
export async function PUT(req: Request) {
  try {
    await requireUser();
    const b = Body.parse(await req.json());
    const profile = {
      person: b.person,
      allergies: b.allergies,
      conditions: b.conditions,
      ...(b.bloodGroup ? { bloodGroup: b.bloodGroup } : {}),
      ...(b.notes ? { notes: b.notes } : {}),
      updatedAt: Date.now(),
    } as HealthProfile;
    await db().collection("health_profiles").doc(b.person).set(profile);
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}
