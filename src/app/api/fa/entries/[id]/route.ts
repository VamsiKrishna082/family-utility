import { z } from "zod";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { BadRequest, requirePerson } from "@/lib/fa/auth";
import { scaleNutrition } from "@/lib/fa/day";
import { COL, changeEntries } from "@/lib/fa/store";
import { Meal, Nutrition } from "@/lib/fa/schemas";
import type { FaEntry } from "@/lib/fa/types";

export const runtime = "nodejs";

const Patch = z.object({
  qty: z.number().positive().max(50).optional(),
  meal: Meal.optional(),
  nutrition: Nutrition.optional(),
});

async function ownEntry(id: string, person: string): Promise<FaEntry> {
  const snap = await db().collection(COL.entries).doc(id).get();
  if (!snap.exists) throw new BadRequest("Entry not found", 404);
  const entry = snap.data() as FaEntry;
  // Both can see both logs; only you edit yours.
  if (entry.person !== person) throw new BadRequest("You can only change your own log", 403);
  return entry;
}

/** Change quantity (nutrition rescales with it), move to another meal, or correct the numbers. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { person } = await requirePerson();
    const { id } = await ctx.params;
    const patch = Patch.parse(await req.json());
    const old = await ownEntry(id, person.id);

    const day = await changeEntries(person.id, old.date, (current) => {
      const cur = current.find((e) => e.id === id) ?? old;
      const qty = patch.qty ?? cur.qty;
      const nutrition = patch.nutrition ?? scaleNutrition(cur, qty / cur.qty);
      return {
        upserts: [{ ...cur, ...nutrition, qty, meal: patch.meal ?? cur.meal, edited: cur.edited || Boolean(patch.nutrition), updatedAt: Date.now() }],
      };
    });
    return ok({ day });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { person } = await requirePerson();
    const { id } = await ctx.params;
    const old = await ownEntry(id, person.id);
    const day = await changeEntries(person.id, old.date, () => ({ deletes: [id] }));
    return ok({ day });
  } catch (e) {
    return fail(e);
  }
}
