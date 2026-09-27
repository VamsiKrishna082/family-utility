/**
 * The friendly daily notifications — pure, tested in scripts/nudges.test.mjs.
 * Messages rotate by day so they don't feel robotic, and never repeat two
 * days running.
 */
import type { Reminder } from "@/lib/reminders";

const MORNING_LINES: Record<number, string[]> = {
  // 0 = Sunday … 6 = Saturday
  0: ["A slow Sunday is allowed. Enjoy it together.", "Sunday — maybe a long breakfast together?"],
  1: ["New week. You've got this.", "Monday — one small thing at a time."],
  5: ["Friday! Plan something nice for the weekend?", "Almost the weekend — hang in there."],
  6: ["Saturday — no alarms needed for the fun stuff.", "Weekend mode: on."],
};
const EVERYDAY = [
  "Have a lovely day.",
  "A glass of water before the coffee — your future self says thanks.",
  "Take a deep breath. Today's going to be fine.",
  "Small steps count. Make today a good one.",
  "Don't forget to eat breakfast.",
  "Be kind to yourself today.",
];

const PARTNER_LINES = [
  (p: string) => `Call ${p} for two minutes — just to hear about the day.`,
  (p: string) => `Send ${p} one thing you love about them.`,
  (p: string) => `Ask ${p} what they'd like for dinner tonight.`,
  (p: string) => `A quick voice note to ${p} can make their afternoon.`,
  (p: string) => `Share something funny from your morning with ${p}.`,
  (p: string) => `Check in on ${p} — has the day been busy?`,
  (p: string) => `Plan one small thing to do with ${p} this evening.`,
];

/** Day number since epoch (IST date) — picks today's line. */
export function dayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

export function morningMessage(input: { name: string; date: string; items: Reminder[] }): { title: string; body: string; url: string } {
  const { name, date, items } = input;
  const title = `Good morning, ${name} ☀️`;
  if (items.length) {
    const lines = items.slice(0, 3).map((r) => `• ${r.title}`);
    const more = items.length > 3 ? `\n+${items.length - 3} more` : "";
    return { title, body: `Today:\n${lines.join("\n")}${more}`, url: items.length === 1 ? items[0].url : "/" };
  }
  // Sunday, Monday, Friday and Saturday get their own lines; other days rotate through the everyday ones.
  const pool = MORNING_LINES[weekdayOf(date)] ?? EVERYDAY;
  return { title, body: pool[dayIndex(date) % pool.length], url: "/" };
}

export function partnerMessage(input: { partnerName: string; date: string }): { title: string; body: string; url: string } {
  const line = PARTNER_LINES[dayIndex(input.date) % PARTNER_LINES.length];
  return { title: `💬 ${input.partnerName}`, body: line(input.partnerName), url: "/" };
}
