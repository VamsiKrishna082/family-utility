import type { DtEvent, DtType } from "@/lib/dates/types";

/** Pure date maths for the Dates section — no I/O, unit-tested in scripts/dates.test.mjs. */

export type Ymd = { y: number; m: number; d: number };

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymdKey = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;

export function parseYmd(s: string): Ymd {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** Today in India, as y/m/d — the household's clock, regardless of server timezone. */
export function todayIST(now = new Date()): Ymd {
  return parseYmd(now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The day this date falls on in a given year — Feb 29 moves to Feb 28 in non-leap years. */
export function onYear(month: number, day: number, year: number): Ymd {
  if (month === 2 && day === 29 && !isLeap(year)) return { y: year, m: 2, d: 28 };
  return { y: year, m: month, d: Math.min(day, daysInMonth(year, month)) };
}

const toUtc = ({ y, m, d }: Ymd) => Date.UTC(y, m - 1, d);
export const daysBetween = (a: Ymd, b: Ymd) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);

export type Occurrence = {
  date: Ymd;
  /** 0 = today, 1 = tomorrow … ; negative only for a one-time date that has passed. */
  daysAway: number;
  /** Years since the recorded year at this occurrence (age turning, anniversary number) — null if the year isn't known. */
  years: number | null;
  past: boolean;
};

/** Next occurrence on or after today (recurring), or the fixed date (one-time). */
export function nextOccurrence(ev: Pick<DtEvent, "month" | "day" | "year" | "recurring">, today: Ymd): Occurrence {
  if (!ev.recurring) {
    const date = onYear(ev.month, ev.day, ev.year ?? today.y);
    const daysAway = daysBetween(today, date);
    return { date, daysAway, years: null, past: daysAway < 0 };
  }
  let date = onYear(ev.month, ev.day, today.y);
  if (daysBetween(today, date) < 0) date = onYear(ev.month, ev.day, today.y + 1);
  const years = ev.year ? date.y - ev.year : null;
  return { date, daysAway: daysBetween(today, date), years: years !== null && years >= 0 ? years : null, past: false };
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** "turns 31", "10th anniversary", "3 years" — or null when the year isn't known. */
export function yearsLabel(type: DtType, years: number | null): string | null {
  if (years === null || years <= 0) return null;
  if (type === "birthday") return `turns ${years}`;
  if (type === "anniversary") return `${ordinal(years)} anniversary`;
  if (type === "remembrance") return `${years} year${years === 1 ? "" : "s"}`;
  return `${ordinal(years)} year`;
}

const BIRTHDAY_MILESTONES = new Set([1, 10, 16, 18, 21, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]);
const ANNIVERSARY_MILESTONES = new Set([1, 5, 10, 15, 20, 25, 30, 40, 50, 60]);

/** Big round numbers worth a badge (and maybe a bigger gift). */
export function isMilestone(type: DtType, years: number | null): boolean {
  if (years === null) return false;
  if (type === "birthday") return BIRTHDAY_MILESTONES.has(years);
  if (type === "anniversary") return ANNIVERSARY_MILESTONES.has(years);
  return false;
}

export function countdownLabel(daysAway: number): string {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway < 0) return `${-daysAway} days ago`;
  if (daysAway < 7) return `in ${daysAway} days`;
  if (daysAway < 14) return "next week";
  if (daysAway < 60) return `in ${Math.round(daysAway / 7)} weeks`;
  return `in ${Math.round(daysAway / 30)} months`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function weekday(date: Ymd, style: "short" | "long" = "short"): string {
  return new Date(toUtc(date)).toLocaleDateString("en-IN", { weekday: style, timeZone: "UTC" });
}

/** "Amma's birthday", or the typed title for festivals/other. */
export function autoTitle(type: DtType, person: string | undefined, fallback: string): string {
  const p = person?.trim();
  if (!p || type === "festival" || type === "other") return fallback.trim();
  const who = /s$/i.test(p) ? `${p}'` : `${p}'s`;
  return type === "remembrance" ? `${who} remembrance day` : `${who} ${type}`;
}

/** Pre-written greeting for the WhatsApp button. Remembrance and festival get their own tone. */
export function greeting(ev: Pick<DtEvent, "type" | "person" | "title">, years: number | null): string {
  const name = ev.person?.trim();
  switch (ev.type) {
    case "birthday":
      return [`Happy birthday${name ? ` ${name}` : ""}! 🎂`, years ? `Wishing you a wonderful ${ordinal(years)} year ahead.` : "Have a wonderful year ahead."].join(" ");
    case "anniversary":
      return `Happy ${years ? `${ordinal(years)} ` : ""}anniversary${name ? ` ${name}` : ""}! 💐 Wishing you both many more happy years together.`;
    case "remembrance":
      return `Thinking of ${name || "them"} today, with love. 🙏`;
    case "festival":
      return `Happy ${ev.title}! Wishing you and the family a joyful celebration. ✨`;
    default:
      return `Thinking of you today${name ? `, ${name}` : ""}!`;
  }
}

/** wa.me link; an Indian 10-digit number gets +91. With no number, WhatsApp opens its contact picker. */
export function whatsappLink(phone: string | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Google Calendar "add event" link for one date, repeating yearly if it does. */
export function googleCalendarLink(ev: Pick<DtEvent, "title" | "month" | "day" | "year" | "recurring" | "notes">, today: Ymd): string {
  const occ = nextOccurrence(ev, today);
  const start = occ.date;
  const endMs = toUtc(start) + 86_400_000;
  const end = new Date(endMs);
  const fmt = (y: number, m: number, d: number) => `${y}${pad(m)}${pad(d)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmt(start.y, start.m, start.d)}/${fmt(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())}`,
    details: ev.notes || "",
  });
  if (ev.recurring) params.set("recur", "RRULE:FREQ=YEARLY");
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Upcoming buckets for the main list. */
export function bucketOf(daysAway: number, today: Ymd, date: Ymd): "today" | "week" | "month" | "later" | "past" {
  if (daysAway < 0) return "past";
  if (daysAway === 0) return "today";
  if (daysAway <= 7) return "week";
  if (date.y === today.y && date.m === today.m) return "month";
  if (daysAway <= 31) return "month";
  return "later";
}

/* -------------------------------- ICS -------------------------------- */

export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 lines must fold at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * Alert N days before, at 9 AM that day. All-day events start at midnight,
 * so "N days before at 9:00" is a trigger of -(N×24 − 9) hours; on the day
 * itself it's +9 hours.
 */
export function alarmTrigger(daysBefore: number): string {
  if (daysBefore === 0) return "PT9H";
  const hours = daysBefore * 24 - 9;
  return `-P${Math.floor(hours / 24)}DT${hours % 24}H`;
}

/**
 * `extra` is pre-built VEVENT lines from other sections (trip days, bookings,
 * to-dos). An Asia/Kolkata VTIMEZONE is always included so timed events there
 * resolve without relying on the client knowing the zone.
 */
export function buildIcs(events: DtEvent[], today: Ymd, calName = "Our dates", extra: string[] = []): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//household//dates//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    "BEGIN:VTIMEZONE", "TZID:Asia/Kolkata",
    "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0530", "TZOFFSETTO:+0530", "TZNAME:IST", "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const ev of events) {
    // Recurring: anchor on the first year we know (or this year); one-time: the date itself.
    const start = ev.recurring ? onYear(ev.month, ev.day, ev.year && ev.year <= today.y ? ev.year : today.y) : onYear(ev.month, ev.day, ev.year ?? today.y);
    const endMs = toUtc(start) + 86_400_000;
    const end = new Date(endMs);
    const d = (y: number, m: number, dd: number) => `${y}${pad(m)}${pad(dd)}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@household-dates`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d(start.y, start.m, start.d)}`,
      `DTEND;VALUE=DATE:${d(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      "TRANSP:TRANSPARENT",
    );
    if (ev.recurring) {
      // Feb 29 dates: repeat on the last day of February so non-leap years still get it.
      lines.push(ev.month === 2 && ev.day === 29 ? "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1" : "RRULE:FREQ=YEARLY");
    }
    const desc = ev.notes;
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    for (const n of [...new Set(ev.remindDays)].sort((a, b) => a - b)) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(n === 0 ? `Today: ${ev.title}` : `${ev.title} in ${n} day${n === 1 ? "" : "s"}`)}`, `TRIGGER:${alarmTrigger(n)}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push(...extra, "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
