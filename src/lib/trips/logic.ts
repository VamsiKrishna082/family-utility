import type { BudgetKey, DocCheckItem, PlanItem, Settlement, SharedCost, TripDay, TripStatus, TripWrapUp } from "@/lib/trips/types";

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
export function settleUp(costs: SharedCost[], rate = 1, settlements: Settlement[] = []): { balances: Record<string, number>; transfers: { from: string; to: string; amount: number }[] } {
  const bal: Record<string, number> = {};
  for (const c of costs) {
    const people = c.splitAmong.length ? c.splitAmong : [c.paidBy];
    const amount = c.amount * rate;
    bal[c.paidBy] = (bal[c.paidBy] ?? 0) + amount;
    for (const p of people) bal[p] = (bal[p] ?? 0) - amount / people.length;
  }
  // Money already paid back (in rupees) moves the balances toward zero.
  for (const st of settlements) {
    bal[st.from] = (bal[st.from] ?? 0) + st.amount;
    bal[st.to] = (bal[st.to] ?? 0) - st.amount;
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

/* ------------------------------ Planner ------------------------------ */

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const DEFAULT_DURATION = 60;

/**
 * Clashes on one day's timeline: an item that starts before the previous
 * timed item has finished (its duration, 1 h if unset). Returns item id →
 * the title it overlaps with.
 */
export function timelineClashes(items: Pick<PlanItem, "id" | "time" | "durationMin" | "title">[]): Map<string, string> {
  const timed = items.filter((i) => i.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const out = new Map<string, string>();
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1];
    const end = toMin(prev.time!) + (prev.durationMin ?? DEFAULT_DURATION);
    if (toMin(timed[i].time!) < end) out.set(timed[i].id, prev.title);
  }
  return out;
}

/** Free time between consecutive timed items (≥ 2 h shows as a gap on the timeline). */
export function gapAfter(prev: Pick<PlanItem, "time" | "durationMin">, next: Pick<PlanItem, "time">): number | null {
  if (!prev.time || !next.time) return null;
  return toMin(next.time) - (toMin(prev.time) + (prev.durationMin ?? DEFAULT_DURATION));
}

/** Google Maps directions through a day's places in order (up to 9 stops, Maps' own limit for links). */
export function directionsLink(places: string[], destination?: string): string | null {
  const stops = places.filter(Boolean).slice(0, 10).map((p) => (destination ? `${p}, ${destination}` : p));
  if (stops.length < 2) return null;
  const params = new URLSearchParams({ api: "1", origin: stops[0], destination: stops[stops.length - 1], travelmode: "driving" });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Heads on the trip: "Us" is the two of you, every other name is one person. */
export const headCount = (travellers: string[]) => travellers.reduce((n, t) => n + (t.trim().toLowerCase() === "us" ? 2 : 1), 0) || 2;

/** Maps a Money category onto the trip's budget-plan buckets (Transport → travel, Stays → stay, …). */
export function budgetBucket(categoryGroup: string, categoryName: string): BudgetKey {
  const g = `${categoryGroup} ${categoryName}`.toLowerCase();
  // Whole words only — "Tripod" is not a trip, "business" is not a bus.
  const has = (words: string) => new RegExp(`\\b(${words})\\b`).test(g);
  if (has("stays?|hotels?|homestays?|resorts?|airbnb|lodging")) return "stay";
  if (has("transport|fuel|petrol|diesel|cabs?|auto|metro|flights?|trains?|bus|buses|travel|trips?|parking|tolls?|taxi")) return "travel";
  if (has("food|dining|restaurants?|snacks?|groceries|grocery|meals?")) return "food";
  if (has("shopping|clothing|clothes|electronics|gifts?|souvenirs?")) return "shopping";
  if (has("fun|movies?|outings?|hobbies|hobby|activit(y|ies)|tickets?|sightseeing")) return "activities";
  return "other";
}

/**
 * Passport / ID check: expired already, expires before the trip ends, or has
 * under 6 months left at the trip's end (many countries require 6 months).
 */
export function docProblem(expiryDate: string, tripEnd: string, today: string): DocCheckItem["problem"] | null {
  if (expiryDate < today) return "expired";
  if (expiryDate <= tripEnd) return "expires_during";
  if (expiryDate < addDays(tripEnd, 183)) return "under_6_months";
  return null;
}

/** UPI "pay" deep link (works from Android/iOS UPI apps). */
export function upiLink(payee: string, payeeName: string, amount: number, note: string): string {
  const p = new URLSearchParams({ pa: payee, pn: payeeName, am: amount.toFixed(2), cu: "INR", tn: note.slice(0, 50) });
  return `upi://pay?${p}`;
}

/* ------------------------------ Journal ------------------------------ */

/**
 * Photo-folder suggestions: for each day, folders whose photos were taken
 * on that day, best match first. `folders` carries each folder's photo
 * dates (from EXIF when Drive has it).
 */
export function matchFolders(
  dayDates: { day: number; date: string }[],
  folders: { folderId: string; folderName: string; path: string; photoDates: string[] }[],
): { day: number; date: string; folderId: string; folderName: string; path: string; photosOnDay: number; photosTotal: number }[] {
  const out = [];
  for (const { day, date } of dayDates) {
    const hits = folders
      .map((f) => ({ ...f, on: f.photoDates.filter((d) => d === date).length }))
      .filter((f) => f.on > 0)
      .sort((a, b) => b.on / b.photoDates.length - a.on / a.photoDates.length || b.on - a.on)
      .slice(0, 3);
    for (const h of hits) out.push({ day, date, folderId: h.folderId, folderName: h.folderName, path: h.path, photosOnDay: h.on, photosTotal: h.photoDates.length });
  }
  return out;
}

/** Group a day's photo times (ISO) into morning / afternoon / evening / night, in IST. */
export function partOfDay(iso: string): "Morning" | "Afternoon" | "Evening" | "Night" {
  const h = Number(new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

/** The trip's wrap-up numbers. `photosByDay` comes from the linked folders. */
export function wrapUp(days: TripDay[], photosByDay: Record<number, number>): TripWrapUp {
  const rated = days.filter((d) => d.rating);
  const best = rated.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.day - b.day)[0];
  const places = new Set(days.flatMap((d) => d.places.map((p) => p.toLowerCase())));
  return {
    days: days.length,
    daysWritten: days.filter((d) => d.story.trim() || d.title.trim()).length,
    places: places.size,
    photos: Object.values(photosByDay).reduce((s, n) => s + n, 0),
    bestDay: best ? best.day : null,
    moods: days.map((d) => d.mood).filter((m): m is string => Boolean(m)),
    highlights: days.filter((d) => d.highlight.trim()).map((d) => ({ day: d.day, text: d.highlight.trim() })),
    foodSpots: days.reduce((n, d) => n + (d.food?.length ?? 0), 0),
  };
}
