import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { dateRange, shiftDate, todayIST } from "@/lib/fa/day";
import { COL } from "@/lib/fa/store";
import { Meal } from "@/lib/fa/schemas";
import { FA_MEAL_LABEL, type FaEntry, type FaFood, type FaQuickResponse } from "@/lib/fa/types";

export const runtime = "nodejs";

const LOOKBACK_DAYS = 14;

/** Human label for the repeat chip: "Yesterday's lunch", or "Mon's lunch" when yesterday's was skipped. */
function repeatLabel(fromDate: string, date: string, meal: keyof typeof FA_MEAL_LABEL) {
  const when = fromDate === shiftDate(date, -1)
    ? "Yesterday’s"
    : `${new Date(`${fromDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}’s`;
  return `${when} ${FA_MEAL_LABEL[meal].toLowerCase()}`;
}

/**
 * GET /api/fa/quick?date=&meal= — the add sheet's quick chips. One small
 * equality query per past day (person + date) rather than a range query, so
 * no composite index is needed.
 */
export async function GET(req: Request) {
  try {
    const { person } = await requirePerson();
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayIST();
    const meal = Meal.parse(url.searchParams.get("meal") ?? "lunch");

    const pastDates = dateRange(shiftDate(date, -1), LOOKBACK_DAYS).reverse(); // newest first
    const [favSnap, ...daySnaps] = await Promise.all([
      db().collection(COL.favourites).where("person", "==", person.id).get(),
      ...pastDates.map((d) => db().collection(COL.entries).where("person", "==", person.id).where("date", "==", d).get()),
    ]);
    const pastEntries = daySnaps.map((s) => s.docs.map((d) => d.data() as FaEntry));

    let repeat: FaQuickResponse["repeat"] = null;
    for (let i = 0; i < pastDates.length && i < 7; i++) {
      const items = pastEntries[i].filter((e) => e.meal === meal);
      if (items.length) {
        repeat = {
          fromDate: pastDates[i],
          meal,
          label: repeatLabel(pastDates[i], date, meal),
          kcal: items.reduce((s, e) => s + e.kcal, 0),
          count: items.length,
        };
        break;
      }
    }

    const counts = new Map<string, { entry: FaEntry; n: number }>();
    for (const e of pastEntries.flat()) {
      const k = `${e.foodKey}|${e.servingLabel}|${e.qty}`;
      const cur = counts.get(k);
      if (cur) cur.n += 1;
      else counts.set(k, { entry: e, n: 1 });
    }
    const frequent = [...counts.values()]
      .filter((c) => c.n >= 2)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map(({ entry }) => ({
        label: entry.qty !== 1 ? `${entry.qty} × ${entry.name}` : `${entry.name} · ${entry.servingLabel}`,
        entry,
      }));

    const favourites = favSnap.docs.map((d) => ({ ...(d.data() as { food: FaFood }).food, favourite: true }));
    return ok({ repeat, favourites, frequent } satisfies FaQuickResponse);
  } catch (e) {
    return fail(e);
  }
}
