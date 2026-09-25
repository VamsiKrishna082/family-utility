import type { SharedCost, TripStatus } from "@/lib/trips/types";

/** Pure date maths for trips — tested in scripts/trips.test.mjs. Dates are YYYY-MM-DD strings in IST. */

export function todayIST(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const endDateOf = (startDate: string, days: number) => addDays(startDate, Math.max(1, days) - 1);

/** The date of day N (1-based). */
export const dateOfDay = (startDate: string, day: number) => addDays(startDate, day - 1);

export function tripStatus(startDate: string | undefined, endDate: string | undefined, today: string): TripStatus {
  if (!startDate || !endDate) return "idea";
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "ongoing";
}

/** "in 12 days", "Day 3 of 5", "2 months ago" … */
export function tripWhen(startDate: string | undefined, endDate: string | undefined, days: number, today: string): string {
  const status = tripStatus(startDate, endDate, today);
  if (status === "idea" || !startDate || !endDate) return "Someday";
  if (status === "ongoing") return `Day ${daysBetween(startDate, today) + 1} of ${days}`;
  if (status === "upcoming") {
    const n = daysBetween(today, startDate);
    return n === 1 ? "Tomorrow" : n < 30 ? `in ${n} days` : n < 60 ? "next month" : `in ${Math.round(n / 30)} months`;
  }
  const n = daysBetween(endDate, today);
  if (n === 0) return "Just finished";
  if (n < 14) return `${n} day${n === 1 ? "" : "s"} ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  const y = Math.round(n / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

export type Phase = "before" | "during" | "after";

/** Where an expense falls relative to the trip — bookings and shopping usually land "before". */
export function phaseOf(date: string, startDate: string, endDate: string): Phase {
  if (date < startDate) return "before";
  if (date > endDate) return "after";
  return "during";
}

/** "12 – 16 Dec 2026", "30 Dec 2026 – 2 Jan 2027" */
export function rangeLabel(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00Z`);
  const e = new Date(`${endDate}T00:00:00Z`);
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-IN", { ...o, timeZone: "UTC" });
  if (startDate === endDate) return f(s, { day: "numeric", month: "short", year: "numeric" });
  if (s.getUTCFullYear() !== e.getUTCFullYear()) return `${f(s, { day: "numeric", month: "short", year: "numeric" })} – ${f(e, { day: "numeric", month: "short", year: "numeric" })}`;
  if (s.getUTCMonth() !== e.getUTCMonth()) return `${f(s, { day: "numeric", month: "short" })} – ${f(e, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${s.getUTCDate()} – ${f(e, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** A day "has content" if anything was written or linked — those are never dropped silently when a trip is shortened. */
export function dayHasContent(d: { title: string; story: string; places: string[]; highlight: string; folderId?: string }): boolean {
  return Boolean(d.title.trim() || d.story.trim() || d.places.length || d.highlight.trim() || d.folderId);
}

/**
 * Shared costs → who owes whom. Each cost is split equally among its
 * people; balances are netted and settled with the fewest transfers
 * (largest debtor pays largest creditor). Amounts in rupees, 2 dp.
 */
export function settleUp(costs: SharedCost[], rate = 1): { balances: Record<string, number>; transfers: { from: string; to: string; amount: number }[] } {
  const bal: Record<string, number> = {};
  for (const c of costs) {
    const people = c.splitAmong.length ? c.splitAmong : [c.paidBy];
    const amount = c.amount * rate;
    bal[c.paidBy] = (bal[c.paidBy] ?? 0) + amount;
    for (const p of people) bal[p] = (bal[p] ?? 0) - amount / people.length;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  for (const k of Object.keys(bal)) bal[k] = round(bal[k]);
  const debtors = Object.entries(bal).filter(([, v]) => v < -0.009).map(([k, v]) => ({ k, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.009).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const transfers: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = round(Math.min(debtors[i].v, creditors[j].v));
    if (amt > 0) transfers.push({ from: debtors[i].k, to: creditors[j].k, amount: amt });
    debtors[i].v = round(debtors[i].v - amt);
    creditors[j].v = round(creditors[j].v - amt);
    if (debtors[i].v <= 0.009) i++;
    if (creditors[j].v <= 0.009) j++;
  }
  return { balances: bal, transfers };
}

/** Is a URL safe to render as a link (http/https only)? Adds https:// to bare domains. */
export function safeUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  const withScheme = /^https?:\/\//i.test(t) ? t : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t) ? `https://${t}` : "";
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Google Maps search link for a place, biased to the trip's destination. */
export const mapsLink = (place: string, destination?: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination ? `${place}, ${destination}` : place)}`;
