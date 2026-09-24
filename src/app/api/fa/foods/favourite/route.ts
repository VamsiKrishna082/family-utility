import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, personFoodId, stripClientFields } from "@/lib/fa/store";
import { Food } from "@/lib/fa/schemas";

export const runtime = "nodejs";

const Body = z.object({ food: Food, on: z.boolean() });

/** PUT — star / unstar a food. Favourites show as one-tap chips in the add sheet. */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const { food, on } = Body.parse(await req.json());
    const ref = db().collection(COL.favourites).doc(personFoodId(person.id, food.key));
    if (on) await ref.set({ person: person.id, food: stripClientFields(food), createdAt: Date.now() });
    else await ref.delete();
    return ok({ on });
  } catch (e) {
    return fail(e);
  }
}
