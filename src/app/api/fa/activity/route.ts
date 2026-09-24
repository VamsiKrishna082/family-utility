import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, buildDay, dayId } from "@/lib/fa/store";
import { DateStr } from "@/lib/fa/schemas";
import { FA_ACTIVITIES, type FaDay, type FaEntry, type FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

const Body = z.object({
  date: DateStr,
  steps: z.number().int().min(0).max(100000),
  workoutMin: z.number().int().min(0).max(600),
  activity: z.enum(FA_ACTIVITIES).optional(),
});

/**
 * PUT /api/fa/activity — steps and workout, entered by hand (no free
 * server-side step API exists; see food.md). stepsSource stays 'manual' so a
 * device sync can be added later without a model change.
 */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const body = Body.parse(await req.json());
    const dayRef = db().collection(COL.days).doc(dayId(person.id, body.date));
    const entriesQ = db().collection(COL.entries).where("person", "==", person.id).where("date", "==", body.date);
    const profileRef = db().collection(COL.profiles).doc(person.id);

    const day = await db().runTransaction(async (t) => {
      const [daySnap, entriesSnap, profileSnap] = await Promise.all([t.get(dayRef), t.get(entriesQ), t.get(profileRef)]);
      const next = buildDay(
        daySnap.exists ? (daySnap.data() as FaDay) : null,
        person.id,
        body.date,
        entriesSnap.docs.map((d) => d.data() as FaEntry),
        profileSnap.exists ? (profileSnap.data() as FaProfile) : null,
        { steps: body.steps, workoutMin: body.workoutMin, activity: body.activity },
      );
      t.set(dayRef, next);
      return next;
    });
    return ok({ day });
  } catch (e) {
    return fail(e);
  }
}
