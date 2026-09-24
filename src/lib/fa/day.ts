import type { FaEntry, FaNutrition, FaStatus, FaStripDay } from "@/lib/fa/types";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Sums a day's entries. Used by the API on every entry change and by the recompute test, so they can't drift. */
export function computeDayTotals(entries: Pick<FaEntry, keyof FaNutrition>[]): FaNutrition & { entryCount: number } {
  const t = entries.reduce(
    (s, e) => ({
      kcal: s.kcal + e.kcal,
      protein: s.protein + e.protein,
      carbs: s.carbs + e.carbs,
      fat: s.fat + e.fat,
      fibre: s.fibre + e.fibre,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
  return {
    kcal: Math.round(t.kcal),
    protein: round1(t.protein),
    carbs: round1(t.carbs),
    fat: round1(t.fat),
    fibre: round1(t.fibre),
    entryCount: entries.length,
  };
}

/**
 * food.md: not logged if no food entries; on target if net kcal is within
 * ±10% of target; over/under otherwise. Without a target yet, a logged day
 * counts as logged but can't be judged, so it reads as "on".
 */
export function dayStatus({ entryCount, eatenKcal, burnedKcal, targetKcal }: { entryCount: number; eatenKcal: number; burnedKcal: number; targetKcal: number | null }): FaStatus {
  if (entryCount === 0) return "none";
  if (!targetKcal) return "on";
  const net = eatenKcal - burnedKcal;
  if (Math.abs(net - targetKcal) <= targetKcal * 0.1) return "on";
  return net > targetKcal ? "over" : "under";
}

/** Nutrition for `qty` of a serving, from a food's base values. */
export function scaleNutrition(base: FaNutrition, mult: number): FaNutrition {
  return {
    kcal: Math.round(base.kcal * mult),
    protein: round1(base.protein * mult),
    carbs: round1(base.carbs * mult),
    fat: round1(base.fat * mult),
    fibre: round1(base.fibre * mult),
  };
}

/** YYYY-MM-DD in IST, the only timezone this household lives in. */
export function todayIST(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `count` dates ending at `end` (inclusive), oldest first. */
export function dateRange(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDate(end, i - count + 1));
}

/**
 * Consecutive logged days ending at `end`. Today not being logged *yet*
 * doesn't break it — the count then runs from yesterday — since the streak
 * only breaks on a day with no entries at all, and today isn't over.
 */
export function loggingStreak(logged: Set<string>, end: string, today: string): number {
  let d = end;
  if (end === today && !logged.has(d)) d = shiftDate(d, -1);
  let n = 0;
  while (logged.has(d)) {
    n += 1;
    d = shiftDate(d, -1);
  }
  return n;
}

export function strip(statusByDate: Map<string, FaStatus>, end: string, count: number): FaStripDay[] {
  return dateRange(end, count).map((date) => ({ date, status: statusByDate.get(date) ?? "none" }));
}
