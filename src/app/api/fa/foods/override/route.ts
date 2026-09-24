import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { COL, personFoodId, stripClientFields } from "@/lib/fa/store";
import { Food, Nutrition } from "@/lib/fa/schemas";

export const runtime = "nodejs";

/** PUT — save your version of a food's numbers (per one base unit). */
export async function PUT(req: Request) {
  try {
    const { person } = await requirePerson();
    const { food, base } = z.object({ food: Food, base: Nutrition }).parse(await req.json());
    await db().collection(COL.overrides).doc(personFoodId(person.id, food.key)).set({
      person: person.id, food: stripClientFields(food), base, updatedAt: Date.now(),
    });
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?key= — "Reset to source": drops your version; past entries keep the numbers they were logged with. */
export async function DELETE(req: Request) {
  try {
    const { person } = await requirePerson();
    const key = new URL(req.url).searchParams.get("key");
    if (!key) throw new Error("Missing key");
    await db().collection(COL.overrides).doc(personFoodId(person.id, key)).delete();
    return ok({ reset: true });
  } catch (e) {
    return fail(e);
  }
}
