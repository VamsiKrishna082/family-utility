import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, getProfile, refreshToday } from "@/lib/fa/store";
import { computeTargets, DEFAULT_DEFICIT_PCT, MAX_DEFICIT_PCT } from "@/lib/fa/targets";
import type { FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { person } = await requirePerson();
    return ok({ profile: await getProfile(person.id) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(250),
  birthYear: z.number().int().min(1930).max(new Date().getFullYear() - 15),
  sex: z.enum(["male", "female"]),
  activityFactor: z.number().min(1.1).max(2),
  deficitPct: z.number().min(0).max(MAX_DEFICIT_PCT).default(DEFAULT_DEFICIT_PCT),
  manualTargetKcal: z.number().int().min(800).max(6000).nullable().optional(),
  proteinG: z.number().min(20).max(400).nullable().optional(),
  fibreG: z.number().min(5).max(80).nullable().optional(),
  stepGoal: z.number().int().min(1000).max(50000).default(10000),
  remindersOn: z.boolean().default(true),
});

/**
 * PUT /api/fa/profile — targets are always derived here (Mifflin-St Jeor +
 * floors), never taken as-is from the client. Returns `flooredManual` so the
 * UI can show the plain doctor/dietitian note when a typed target was raised.
 */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const body = Body.parse(await req.json());
    const t = computeTargets({
      ...body,
      manualTargetKcal: body.manualTargetKcal ?? undefined,
      proteinG: body.proteinG ?? undefined,
      fibreG: body.fibreG ?? undefined,
    });
    const profile: FaProfile = {
      person: person.id,
      heightCm: body.heightCm,
      weightKg: body.weightKg,
      birthYear: body.birthYear,
      sex: body.sex,
      activityFactor: body.activityFactor,
      deficitPct: t.deficitPct,
      ...(body.manualTargetKcal ? { manualTargetKcal: body.manualTargetKcal } : {}),
      targetKcal: t.targetKcal,
      bmrKcal: t.bmrKcal,
      maintenanceKcal: t.maintenanceKcal,
      proteinG: t.proteinG,
      fibreG: t.fibreG,
      fatG: t.fatG,
      carbsG: t.carbsG,
      stepGoal: body.stepGoal,
      remindersOn: body.remindersOn,
      updatedAt: Date.now(),
    };
    await db().collection(COL.profiles).doc(person.id).set(profile);
    await refreshToday(person.id, profile);
    return ok({ profile, flooredManual: t.flooredManual });
  } catch (e) {
    return fail(e);
  }
}
