// Pure unit tests for the Dates section's date maths and calendar feed — no Firestore, no network.
// Run: npm run test:dates
import { test } from "node:test";
import assert from "node:assert/strict";
import { alarmTrigger, autoTitle, buildIcs, countdownLabel, greeting, isMilestone, nextOccurrence, onYear, whatsappLink, yearsLabel } from "../src/lib/dates/logic.ts";

const today = { y: 2026, m: 9, d: 25 };

test("next occurrence rolls to next year once this year's has passed", () => {
  assert.deepEqual(nextOccurrence({ month: 9, day: 25, recurring: true }, today).daysAway, 0);
  assert.equal(nextOccurrence({ month: 9, day: 26, recurring: true }, today).daysAway, 1);
  const past = nextOccurrence({ month: 9, day: 24, recurring: true }, today);
  assert.equal(past.date.y, 2027);
  assert.equal(past.daysAway, 364);
});

test("age / anniversary number counts at the next occurrence", () => {
  assert.equal(nextOccurrence({ month: 10, day: 1, year: 1995, recurring: true }, today).years, 31);
  assert.equal(nextOccurrence({ month: 1, day: 5, year: 1995, recurring: true }, today).years, 32); // Jan 2027
  assert.equal(nextOccurrence({ month: 10, day: 1, recurring: true }, today).years, null);
});

test("Feb 29 falls on Feb 28 in non-leap years", () => {
  assert.deepEqual(onYear(2, 29, 2027), { y: 2027, m: 2, d: 28 });
  assert.deepEqual(onYear(2, 29, 2028), { y: 2028, m: 2, d: 29 });
  assert.deepEqual(nextOccurrence({ month: 2, day: 29, recurring: true }, today).date, { y: 2027, m: 2, d: 28 });
});

test("one-time dates don't repeat", () => {
  const o = nextOccurrence({ month: 9, day: 20, year: 2026, recurring: false }, today);
  assert.equal(o.past, true);
  assert.equal(o.daysAway, -5);
});

test("labels", () => {
  assert.equal(yearsLabel("birthday", 31), "turns 31");
  assert.equal(yearsLabel("anniversary", 10), "10th anniversary");
  assert.equal(yearsLabel("anniversary", 1), "1st anniversary");
  assert.equal(yearsLabel("anniversary", 22), "22nd anniversary");
  assert.equal(yearsLabel("remembrance", 3), "3 years");
  assert.equal(isMilestone("birthday", 60), true);
  assert.equal(isMilestone("anniversary", 25), true);
  assert.equal(isMilestone("birthday", 33), false);
  assert.equal(countdownLabel(0), "Today");
  assert.equal(countdownLabel(1), "Tomorrow");
  assert.equal(countdownLabel(3), "in 3 days");
  assert.equal(autoTitle("birthday", "Amma", ""), "Amma's birthday");
  assert.equal(autoTitle("anniversary", "Ravi & Priya", ""), "Ravi & Priya's anniversary");
  assert.equal(autoTitle("festival", undefined, "Diwali"), "Diwali");
});

test("WhatsApp link adds +91 to a 10-digit number", () => {
  assert.match(whatsappLink("98765 43210", "Hi"), /^https:\/\/wa\.me\/919876543210\?text=Hi$/);
  assert.match(whatsappLink(undefined, "Hi"), /^https:\/\/wa\.me\/\?text=Hi$/);
});

test("calendar feed: yearly all-day events with 9 AM alerts", () => {
  assert.equal(alarmTrigger(0), "PT9H");
  assert.equal(alarmTrigger(1), "-P0DT15H");
  assert.equal(alarmTrigger(7), "-P6DT15H");
  const ics = buildIcs([{
    id: "a1", type: "birthday", title: "Amma's birthday", person: "Amma", month: 2, day: 29, year: 1964, recurring: true,
    notes: "Likes jasmine, sarees", remindDays: [7, 0], giftIdeas: [], gifts: [], createdBy: "x", createdAt: 0, updatedAt: 0,
  }], today);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:19640229/);
  assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1/);
  assert.match(ics, /SUMMARY:Amma's birthday/);
  assert.match(ics, /DESCRIPTION:Likes jasmine\\, sarees/);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, 2);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l, "utf8") <= 75));
});

test("greetings read naturally", () => {
  assert.equal(greeting({ type: "birthday", person: "Amma", title: "" }, 62), "Happy birthday Amma! 🎂 Wishing you a wonderful 62nd year ahead.");
  assert.equal(greeting({ type: "anniversary", person: "Ravi & Priya", title: "" }, 10), "Happy 10th anniversary Ravi & Priya! 💐 Wishing you both many more happy years together.");
  assert.equal(greeting({ type: "festival", title: "Diwali" }, null), "Happy Diwali! Wishing you and the family a joyful celebration. ✨");
});
