import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { BadRequest, requirePerson } from "@/lib/fa/auth";
import { COL, changeEntries } from "@/lib/fa/store";
import { DateStr, Meal } from "@/lib/fa/schemas";
import type { FaEntry } from "@/lib/fa/types";

export const runtime = "nodejs";

const Body = z.object({ fromDate: DateStr, meal: Meal, toDate: DateStr, toMeal: Meal.optional() });

/** Copies a previous meal of yours in one call — "same as yesterday" is two taps: Log food → the chip. */
export async function POST(req: Request) {
  try {
    const { person } = await requirePerson();
    const { fromDate, meal, toDate, toMeal } = Body.parse(await req.json());
    const snap = await db().collection(COL.entries).where("person", "==", person.id).where("date", "==", fromDate).get();
    const source = snap.docs.map((d) => d.data() as FaEntry).filter((e) => e.meal === meal);
    if (!source.length) throw new BadRequest("Nothing logged for that meal");

    const now = Date.now();
    const copies: FaEntry[] = source.map((e, i) => ({
      ...e,
      id: db().collection(COL.entries).doc().id,
      date: toDate,
      meal: toMeal ?? meal,
      createdAt: now + i,
      updatedAt: now + i,
    }));
    const day = await changeEntries(person.id, toDate, () => ({ upserts: copies }));
    return ok({ added: copies.length, day });
  } catch (e) {
    return fail(e);
  }
}
