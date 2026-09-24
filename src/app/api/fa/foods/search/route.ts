import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { searchLocalDishes, withGrams } from "@/lib/fa/dishes";
import { lookupBarcode, searchOpenFoodFacts, searchUsda } from "@/lib/fa/sources";
import { COL, cacheFood, foodDocId } from "@/lib/fa/store";
import type { FaFood, FaNutrition, FaSearchResponse } from "@/lib/fa/types";

export const runtime = "nodejs";

type OverrideDoc = { person: string; food: FaFood; base: FaNutrition; updatedAt: number };

/** An override row shown as "<name> — your version", keyed to the same food so a re-edit updates it. */
function asYours(o: OverrideDoc): FaFood {
  // A food you entered yourself has no source version behind it — no suffix, nothing to reset to.
  if (o.food.source === "yours") return { ...o.food, base: o.base, editedAt: o.updatedAt };
  return { ...o.food, name: `${o.food.name} — your version`, source: "yours", base: o.base, sourceBase: o.food.base, editedAt: o.updatedAt };
}

const matches = (name: string, terms: string[]) => {
  const words = name.toLowerCase().split(/[^a-z0-9]+/);
  return terms.every((t) => words.some((w) => w.startsWith(t)));
};

/**
 * GET /api/fa/foods/search?q=&barcode= — food.md resolution order: your
 * foods (anything you edited), the local Indian dish table, Open Food Facts,
 * then USDA (if a key is configured). AI estimate is a separate endpoint.
 */
export async function GET(req: Request) {
  try {
    const { person } = await requirePerson();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const barcode = (url.searchParams.get("barcode") ?? "").replace(/\D/g, "").slice(0, 20);

    const [overridesSnap, favSnap] = await Promise.all([
      db().collection(COL.overrides).where("person", "==", person.id).get(),
      db().collection(COL.favourites).where("person", "==", person.id).get(),
    ]);
    const overrides = overridesSnap.docs.map((d) => d.data() as OverrideDoc);
    const favKeys = new Set(favSnap.docs.map((d) => (d.data() as { food: FaFood }).food.key));
    const mark = (f: FaFood): FaFood => ({ ...withGrams(f), favourite: favKeys.has(f.key) });

    if (barcode) {
      const cached = await db().collection(COL.foods).doc(foodDocId(`off:${barcode}`)).get();
      const found = cached.exists ? (cached.data() as FaFood) : await lookupBarcode(barcode);
      if (found && !cached.exists) await cacheFood(found);
      const mine = overrides.find((o) => o.food.key === `off:${barcode}`);
      const results = [mine ? asYours(mine) : null, found].filter((f): f is FaFood => !!f).map(mark);
      return ok({ results, online: true } satisfies FaSearchResponse);
    }

    if (q.length < 2) return ok({ results: [], online: false } satisfies FaSearchResponse);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

    const yours = overrides.filter((o) => matches(o.food.name, terms)).map(asYours);
    const local = searchLocalDishes(q, 10);
    // Online sources only when the offline ones are thin — keeps typing snappy.
    const goOnline = local.length + yours.length < 6 && q.length >= 3;
    const [off, usda] = goOnline ? await Promise.all([searchOpenFoodFacts(q), searchUsda(q)]) : [[], []];

    const seen = new Set<string>();
    const results = [...yours, ...local, ...off, ...usda].filter((f) => {
      const k = `${f.source}:${f.key}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return ok({ results: results.slice(0, 16).map(mark), online: goOnline } satisfies FaSearchResponse);
  } catch (e) {
    return fail(e);
  }
}
