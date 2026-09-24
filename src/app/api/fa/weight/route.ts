import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { dateRange, todayIST } from "@/lib/fa/day";
import { COL, getProfile, refreshToday } from "@/lib/fa/store";
import { DateStr } from "@/lib/fa/schemas";
import { computeTargets } from "@/lib/fa/targets";
import type { FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

const Body = z.object({ date: DateStr, weightKg: z.number().min(30).max(250) });

/**
 * PUT /api/fa/weight — log as often as you like. Targets recalculate from the
 * 7-day rolling average, not the single reading, so a water-weight day
 * doesn't move them.
 */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const { date, weightKg } = Body.parse(await req.json());
    await db().collection(COL.weights).doc(`${person.id}_${date}`).set({ person: person.id, date, weightKg, updatedAt: Date.now() });

    const last7 = dateRange(todayIST(), 7);
    const snap = await db().collection(COL.weights).where("person", "==", person.id).get();
    const recent = snap.docs.map((d) => d.data() as { date: string; weightKg: number }).filter((w) => last7.includes(w.date));
    const avg = recent.length ? Math.round((recent.reduce((s, w) => s + w.weightKg, 0) / recent.length) * 10) / 10 : weightKg;

    const profile = await getProfile(person.id);
    let updated: FaProfile | null = null;
    if (profile) {
      const t = computeTargets({ ...profile, weightKg: avg });
      updated = {
        ...profile,
        weightKg: avg,
        targetKcal: t.targetKcal,
        bmrKcal: t.bmrKcal,
        maintenanceKcal: t.maintenanceKcal,
        proteinG: t.proteinG,
        fatG: t.fatG,
        carbsG: t.carbsG,
        updatedAt: Date.now(),
      };
      await db().collection(COL.profiles).doc(person.id).set(updated);
      await refreshToday(person.id, updated);
    }
    return ok({ weightAvg7: avg, profile: updated });
  } catch (e) {
    return fail(e);
  }
}
