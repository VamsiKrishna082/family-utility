import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, cacheFood, changeEntries, personFoodId, stripClientFields } from "@/lib/fa/store";
import { DateStr, Food, Meal, Nutrition } from "@/lib/fa/schemas";
import type { FaEntry } from "@/lib/fa/types";

export const runtime = "nodejs";

const Body = z.object({
  date: DateStr,
  meal: Meal,
  food: Food,
  servingLabel: z.string().max(60),
  qty: z.number().positive().max(50),
  /** Total grams eaten, when known — always sent when logging by weight. */
  grams: z.number().positive().max(10000).optional(),
  /** Totals for this entry (serving × qty), as shown on the "Add N kcal" button. */
  nutrition: Nutrition,
  /** Set when the person edited the numbers: saved as their own version of the food, per one base unit. */
  overrideBase: Nutrition.optional(),
});

export async function POST(req: Request) {
  try {
    const { person } = await requirePerson();
    const body = Body.parse(await req.json());
    const now = Date.now();
    const ref = db().collection(COL.entries).doc();
    const entry: FaEntry = {
      id: ref.id,
      person: person.id,
      date: body.date,
      meal: body.meal,
      foodKey: body.food.key,
      name: body.food.name,
      servingLabel: body.servingLabel,
      qty: body.qty,
      ...(body.grams ? { grams: Math.round(body.grams) } : {}),
      ...body.nutrition,
      source: body.overrideBase ? "yours" : body.food.source,
      edited: Boolean(body.overrideBase),
      createdAt: now,
      updatedAt: now,
    };

    // The user's version lives beside the shared food rather than changing it (food.md).
    if (body.overrideBase) {
      await db().collection(COL.overrides).doc(personFoodId(person.id, body.food.key)).set({
        person: person.id,
        food: stripClientFields(body.food),
        base: body.overrideBase,
        updatedAt: now,
      });
    }
    await cacheFood(body.food);
    const day = await changeEntries(person.id, body.date, () => ({ upserts: [entry] }));
    return ok({ entry, day });
  } catch (e) {
    return fail(e);
  }
}
