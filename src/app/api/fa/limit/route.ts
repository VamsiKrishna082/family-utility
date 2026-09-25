import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, getLimit, getProfile, refreshToday } from "@/lib/fa/store";
import { effectiveTarget } from "@/lib/fa/targets";

export const runtime = "nodejs";

/** GET — your own daily calorie limit, and what it works out to after the BMR floor. */
export async function GET() {
  try {
    const { person } = await requirePerson();
    const [limit, profile] = await Promise.all([getLimit(person.id), getProfile(person.id)]);
    return ok({ limit, ...effectiveTarget(profile, limit) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  /** null removes the limit (back to the profile's computed target). */
  kcal: z.number().int().min(800).max(6000).nullable(),
  mode: z.enum(["block", "warn"]).default("block"),
});

/** PUT — set or clear your daily limit; today's status is re-judged right away. */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const { kcal, mode } = Body.parse(await req.json());
    const ref = db().collection(COL.limits).doc(person.id);
    if (kcal === null) await ref.delete();
    else await ref.set({ kcal, mode, updatedAt: Date.now() });
    const [limit, profile] = await Promise.all([getLimit(person.id), getProfile(person.id)]);
    await refreshToday(person.id, profile);
    return ok({ limit, ...effectiveTarget(profile, limit) });
  } catch (e) {
    return fail(e);
  }
}
