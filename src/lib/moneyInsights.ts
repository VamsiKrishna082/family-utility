/**
 * The Money "this month in a few lines" summary — pure, tested in
 * scripts/money-insights.test.mjs. For the month you're in, spending is
 * compared with last month *up to the same day of its cycle* (a half month
 * against a whole one would always look good); a finished month is compared
 * with the whole previous month.
 */
export type Totals = { expensePaise: number; byCategory: Record<string, number> };

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const MIN_MOVE_PAISE = 50_000; // ₹500 — smaller changes aren't worth a line
const MIN_MOVE_PCT = 15;

export function monthInsights(input: {
  isCurrent: boolean;
  prevLabel: string;
  cur: Totals & { incomePaise: number; savingPaise: number };
  prev: Totals;
  /** Expense category id → name; only these count as spending. */
  expenseCats: Record<string, string>;
}): string[] {
  const { cur, prev, expenseCats, isCurrent, prevLabel } = input;
  const spend = (t: Totals) => Object.entries(t.byCategory).filter(([id]) => id in expenseCats).reduce((s, [, v]) => s + v, 0);
  const now = spend(cur);
  const before = spend(prev);
  const lines: string[] = [];
  const prevName = prevLabel.split(" ")[0];

  if (now > 0 || before > 0) {
    if (before === 0) lines.push(`${rupees(now)} spent${isCurrent ? " so far" : ""} — nothing to compare with in ${prevName}.`);
    else {
      const pct = Math.round(((now - before) / before) * 100);
      const vs = isCurrent ? `by this day in ${prevName} (${rupees(before)})` : `${prevName} (${rupees(before)})`;
      lines.push(
        Math.abs(pct) < 3
          ? `${rupees(now)} spent${isCurrent ? " so far" : ""} — about the same as ${vs}.`
          : `${rupees(now)} spent${isCurrent ? " so far" : ""} — ${Math.abs(pct)}% ${pct > 0 ? "more" : "less"} than ${vs}.`,
      );
    }
  }

  const moves = Object.keys(expenseCats)
    .map((id) => ({ id, now: cur.byCategory[id] ?? 0, before: prev.byCategory[id] ?? 0 }))
    .map((m) => ({ ...m, diff: m.now - m.before }))
    .filter((m) => Math.abs(m.diff) >= MIN_MOVE_PAISE && (m.before === 0 || Math.abs(m.diff) / m.before * 100 >= MIN_MOVE_PCT))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 2);
  for (const m of moves) {
    const pct = m.before ? ` (${m.diff > 0 ? "+" : "−"}${Math.round(Math.abs(m.diff) / m.before * 100)}%)` : "";
    lines.push(m.before === 0
      ? `${expenseCats[m.id]}: ${rupees(m.now)} — new this month.`
      : `${expenseCats[m.id]}: ${rupees(m.now)}, ${m.diff > 0 ? "up" : "down"} ${rupees(Math.abs(m.diff))}${pct}.`);
  }

  if (cur.incomePaise > 0 && cur.savingPaise > 0) {
    lines.push(`You've put ${Math.round((cur.savingPaise / cur.incomePaise) * 100)}% of income into savings.`);
  }
  return lines;
}

/** YYYY-MM-DD of the day in the previous cycle that matches `today` in the current one (same number of days in), clipped to that cycle's end. */
export function sameDayLastCycle(today: string, curStart: string, prevStart: string, prevEnd: string): string {
  const ms = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const elapsed = Math.round((ms(today) - ms(curStart)) / 86_400_000);
  const target = new Date(ms(prevStart) + elapsed * 86_400_000).toISOString().slice(0, 10);
  return target > prevEnd ? prevEnd : target;
}
