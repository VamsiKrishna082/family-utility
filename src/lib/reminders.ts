import { daysBetween, nextOccurrence, parseYmd, weekday, yearsLabel, type Ymd } from "@/lib/dates/logic";
import type { DtEvent } from "@/lib/dates/types";

/**
 * What's coming up across the app — the Home "Today" card and the morning
 * reminder both come from here, so they never disagree. Pure: tested in
 * scripts/reminders.test.mjs; the server loads the data (src/lib/remindersData.ts).
 */

export const REMINDER_KINDS = ["dates", "documents", "trips", "money"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  dates: "Birthdays & anniversaries",
  documents: "Document renewals",
  trips: "Trips & to-dos",
  money: "Credit card dues",
};

export type Reminder = {
  kind: ReminderKind;
  /** Stable per item and occasion — the day's send log uses it so nothing is sent twice. */
  key: string;
  title: string;
  detail: string;
  daysAway: number;
  url: string;
  /** Worth a notification this morning (vs. only listed on Home). */
  notify: boolean;
};

export type ReminderDoc = { id: string; name: string; expiryDate?: string; expiryLabel?: "renew" | "expires" | "keep_till"; archived?: boolean };
export type ReminderTrip = {
  id: string; name: string; startDate?: string; endDate?: string;
  todos: { id: string; text: string; due?: string; done: boolean }[];
  bookings: { id: string; title: string; date?: string; time?: string }[];
};
export type ReminderCard = { id: string; name: string; outstandingPaise: number };

const DOC_NOTIFY_DAYS = new Set([30, 14, 7, 3, 1, 0]);
const TRIP_NOTIFY_DAYS = new Set([7, 3, 1, 0]);
const DOC_VERB = { renew: "renews", expires: "expires", keep_till: "keep till" } as const;

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
/** Exact for reminders: "today", "tomorrow", "in 7 days (Mon)". */
const when = (days: number, date: Ymd) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days (${weekday(date)})`);

export function upcoming(input: { today: Ymd; dates: DtEvent[]; docs: ReminderDoc[]; trips: ReminderTrip[]; cards: ReminderCard[] }): Reminder[] {
  const { today } = input;
  const out: Reminder[] = [];

  // Birthdays, anniversaries … on each date's own remind days, and the day itself; listed a week ahead.
  for (const ev of input.dates) {
    const occ = nextOccurrence(ev, today);
    if (occ.past || occ.daysAway > 30) continue;
    const notify = occ.daysAway === 0 || (ev.remindDays ?? []).includes(occ.daysAway);
    if (occ.daysAway > 7 && !notify) continue;
    const ys = yearsLabel(ev.type, occ.years);
    out.push({
      kind: "dates",
      key: `date:${ev.id}:${occ.date.y}:${occ.daysAway}`,
      title: `${ev.title} ${when(occ.daysAway, occ.date)}`,
      detail: [ys, ev.giftIdeas?.length ? `gift ideas: ${ev.giftIdeas.slice(0, 2).join(", ")}` : ""].filter(Boolean).join(" · "),
      daysAway: occ.daysAway,
      url: `/dates#${ev.id}`,
      notify,
    });
  }

  // Documents: 30/14/7/3/1/0 days before; overdue ones are listed always but only nudged on Mondays.
  const isMonday = weekday(today, "long") === "Monday";
  for (const d of input.docs) {
    if (d.archived || !d.expiryDate) continue;
    const days = daysBetween(today, parseYmd(d.expiryDate));
    if (days > 30) continue;
    const verb = DOC_VERB[d.expiryLabel ?? "expires"];
    out.push({
      kind: "documents",
      key: `doc:${d.id}:${d.expiryDate}:${days < 0 ? `overdue-${today.y}-${today.m}-${today.d}` : days}`,
      title: days < 0 ? `${d.name} — ${verb === "keep till" ? "past its keep-till date" : `${verb === "renews" ? "renewal" : "expired"} ${-days} day${days === -1 ? "" : "s"} ago`}` : `${d.name} ${verb} ${when(days, parseYmd(d.expiryDate))}`,
      detail: "",
      daysAway: days,
      url: `/docs/${d.id}`,
      notify: days < 0 ? isMonday : DOC_NOTIFY_DAYS.has(days),
    });
  }

  for (const t of input.trips) {
    // The trip itself: a week, three days, the day before and the day of.
    if (t.startDate) {
      const days = daysBetween(today, parseYmd(t.startDate));
      const openTodos = t.todos.filter((x) => !x.done).length;
      if (days >= 0 && days <= 14) {
        out.push({
          kind: "trips",
          key: `trip:${t.id}:${t.startDate}:${days}`,
          title: `${t.name} starts ${when(days, parseYmd(t.startDate))}`,
          detail: openTodos ? `${openTodos} to-do${openTodos === 1 ? "" : "s"} still open` : "All to-dos done",
          daysAway: days,
          url: `/trips/${t.id}`,
          notify: TRIP_NOTIFY_DAYS.has(days),
        });
      }
    }
    // To-dos due today (or overdue and still open), and bookings dated today.
    for (const todo of t.todos) {
      if (todo.done || !todo.due) continue;
      const days = daysBetween(today, parseYmd(todo.due));
      if (days > 1) continue;
      out.push({
        kind: "trips",
        key: `todo:${t.id}:${todo.id}:${days <= 0 ? "due" : "tomorrow"}`,
        title: days < 0 ? `Overdue: ${todo.text}` : `${todo.text} — due ${days === 0 ? "today" : "tomorrow"}`,
        detail: t.name,
        daysAway: days,
        url: `/trips/${t.id}`,
        notify: days >= 0,
      });
    }
    for (const b of t.bookings) {
      if (!b.date) continue;
      const days = daysBetween(today, parseYmd(b.date));
      if (days !== 0 && days !== 1) continue;
      out.push({
        kind: "trips",
        key: `booking:${t.id}:${b.id}:${days}`,
        title: `${b.title} ${days === 0 ? "today" : "tomorrow"}${b.time ? ` at ${b.time}` : ""}`,
        detail: t.name,
        daysAway: days,
        url: `/trips/${t.id}`,
        notify: true,
      });
    }
  }

  // Credit cards with something owed: listed always, nudged on the 1st and 15th.
  for (const c of input.cards) {
    if (c.outstandingPaise <= 0) continue;
    out.push({
      kind: "money",
      key: `card:${c.id}:${today.y}-${today.m}-${today.d}`,
      title: `${rupees(c.outstandingPaise)} still owed on ${c.name}`,
      detail: "Pay the bill in Money to clear it",
      daysAway: 0,
      url: "/money",
      notify: today.d === 1 || today.d === 15,
    });
  }

  return out.sort((a, b) => a.daysAway - b.daysAway || a.kind.localeCompare(b.kind));
}

/** The morning notification: one per device, the most pressing few lines. */
export function digestMessage(items: Reminder[]): { title: string; body: string; url: string } | null {
  if (!items.length) return null;
  const lines = items.slice(0, 4).map((r) => r.title);
  const more = items.length > 4 ? `\n+${items.length - 4} more` : "";
  return {
    title: items.length === 1 ? "Today" : `Today · ${items.length} reminders`,
    body: lines.join("\n") + more,
    url: items.length === 1 ? items[0].url : "/",
  };
}
