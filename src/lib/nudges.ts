/**
 * The friendly daily notifications — good morning, the afternoon check-in
 * and good night — each signed with love from your partner. Pure, tested in
 * scripts/nudges.test.mjs. Lines rotate by day so they don't feel robotic,
 * and never repeat two days running.
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

const NIGHT_LINES: Record<number, string[]> = {
  5: ["Friday night — the weekend starts now. Sleep in tomorrow?"],
  6: ["Saturday night — rest up for a slow Sunday."],
  0: ["Sunday night — sleep well, a fresh week tomorrow."],
};
const NIGHTLY = [
  "Sleep well — tomorrow's a new day.",
  "Phones down, lights off. Rest well.",
  "Thank you for today.",
  "Sweet dreams.",
  "Whatever today was, you did well.",
  "Get some good sleep tonight.",
];

/** The line every daily note ends with — from the other person. */
export const loveFrom = (partnerName: string) => `Love you ❤️ — ${partnerName}`;

/** Day number since epoch (IST date) — picks today's line. */
export function dayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const pick = <T,>(pool: T[], date: string) => pool[dayIndex(date) % pool.length];

export function morningMessage(input: { name: string; partnerName?: string; date: string; items: Reminder[] }): { title: string; body: string; url: string } {
  const { name, partnerName, date, items } = input;
  const title = `Good morning, ${name} ☀️`;
  const love = partnerName ? `\n${loveFrom(partnerName)}` : "";
  if (items.length) {
    const lines = items.slice(0, 3).map((r) => `• ${r.title}`);
    const more = items.length > 3 ? `\n+${items.length - 3} more` : "";
    return { title, body: `Today:\n${lines.join("\n")}${more}${love}`, url: items.length === 1 ? items[0].url : "/" };
  }
  // Sunday, Monday, Friday and Saturday get their own lines; other days rotate through the everyday ones.
  return { title, body: `${pick(MORNING_LINES[weekdayOf(date)] ?? EVERYDAY, date)}${love}`, url: "/" };
}

export function partnerMessage(input: { partnerName: string; date: string }): { title: string; body: string; url: string } {
  const line = pick(PARTNER_LINES, input.date);
  return { title: `💬 ${input.partnerName}`, body: `${line(input.partnerName)}\n${loveFrom(input.partnerName)}`, url: "/" };
}

export function nightMessage(input: { name: string; partnerName?: string; date: string }): { title: string; body: string; url: string } {
  const { name, partnerName, date } = input;
  const line = pick(NIGHT_LINES[weekdayOf(date)] ?? NIGHTLY, date);
  return { title: `Good night, ${name} 🌙`, body: `${line}${partnerName ? `\n${loveFrom(partnerName)}` : ""}`, url: "/" };
}
