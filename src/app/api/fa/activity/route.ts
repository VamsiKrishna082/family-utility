import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { BadRequest, requirePerson } from "@/lib/fa/auth";
import { personById } from "@/lib/fa/people";
import { COL, buildDay, dayId } from "@/lib/fa/store";
import { DateStr } from "@/lib/fa/schemas";
import { FA_ACTIVITIES, type FaDay, type FaEntry, type FaLimit, type FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

const Body = z.object({
  /** Whose movement — either of you can fill it in for the other. Defaults to the signed-in person. */
  person: z.string().optional(),
  date: DateStr,
  steps: z.number().int().min(0).max(100000),
  workoutMin: z.number().int().min(0).max(600),
  activity: z.enum(FA_ACTIVITIES).optional(),
});

/**
 * PUT /api/fa/activity — steps and workout, entered by hand (no free
 * server-side step API exists; see food.md). stepsSource stays 'manual' so a
 * device sync can be added later without a model change. Unlike food
 * entries, either person may enter the other's steps (asked for explicitly).
 */
export async function PUT(req: Request) {
  try {
    const { person: me } = await requirePerson();
    const body = Body.parse(await req.json());
    const person = body.person ? personById(body.person) : me;
    if (!person) throw new BadRequest("Unknown person");
    const dayRef = db().collection(COL.days).doc(dayId(person.id, body.date));
    const entriesQ = db().collection(COL.entries).where("person", "==", person.id).where("date", "==", body.date);
    const profileRef = db().collection(COL.profiles).doc(person.id);
    const limitRef = db().collection(COL.limits).doc(person.id);

    const day = await db().runTransaction(async (t) => {
      const [daySnap, entriesSnap, profileSnap, limitSnap] = await Promise.all([t.get(dayRef), t.get(entriesQ), t.get(profileRef), t.get(limitRef)]);
      const next = buildDay(
        daySnap.exists ? (daySnap.data() as FaDay) : null,
        person.id,
        body.date,
        entriesSnap.docs.map((d) => d.data() as FaEntry),
        profileSnap.exists ? (profileSnap.data() as FaProfile) : null,
        { steps: body.steps, workoutMin: body.workoutMin, activity: body.activity },
        limitSnap.exists ? (limitSnap.data() as FaLimit) : null,
      );
      t.set(dayRef, next);
      return next;
    });
    return ok({ day });
  } catch (e) {
    return fail(e);
  }
}
