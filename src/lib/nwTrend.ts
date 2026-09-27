/**
 * Net worth trend and a plain "at this pace" projection — pure, tested in
 * scripts/nw-trend.test.mjs. The pace is the average monthly change over
 * the most recent months with data (up to 6), so one odd month doesn't
 * swing it; it's a straight line, not a forecast of markets.
 */
export type NwPoint = { monthKey: string; netPaise: number };

export function shiftMonth(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

export function pace(points: NwPoint[], window = 6): { perMonthPaise: number; months: number } | null {
  const sorted = [...points].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (sorted.length < 2) return null;
  const recent = sorted.slice(-window);
  const span = monthsBetween(recent[0].monthKey, recent[recent.length - 1].monthKey);
  if (span <= 0) return null;
  return { perMonthPaise: Math.round((recent[recent.length - 1].netPaise - recent[0].netPaise) / span), months: span };
}

/** The projected line from the latest month, `ahead` months on. */
export function project(points: NwPoint[], ahead = 6): NwPoint[] {
  const p = pace(points);
  if (!p) return [];
  const last = [...points].sort((a, b) => a.monthKey.localeCompare(b.monthKey)).at(-1)!;
  return Array.from({ length: ahead + 1 }, (_, i) => ({ monthKey: shiftMonth(last.monthKey, i), netPaise: last.netPaise + p.perMonthPaise * i }));
}

/** End of the financial year (March) on or after `mk`. */
export function fyEndMonth(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  return `${m <= 3 ? y : y + 1}-03`;
}

export function projectionAt(points: NwPoint[], targetMonth: string): number | null {
  const p = pace(points);
  if (!p) return null;
  const last = [...points].sort((a, b) => a.monthKey.localeCompare(b.monthKey)).at(-1)!;
  const n = monthsBetween(last.monthKey, targetMonth);
  return n < 0 ? null : last.netPaise + p.perMonthPaise * n;
}
