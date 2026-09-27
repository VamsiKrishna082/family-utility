// Pure tests for reminders (Home "Today" + morning notification). Run: npm run test:reminders
import { test } from "node:test";
import assert from "node:assert/strict";
import { digestMessage, upcoming } from "../src/lib/reminders.ts";

const today = { y: 2026, m: 9, d: 28 }; // a Monday
const ev = (id, month, day, extra = {}) => ({ id, type: "birthday", title: `${id}'s birthday`, month, day, recurring: true, notes: "", remindDays: [7, 1], giftIdeas: [], gifts: [], createdBy: "x", createdAt: 0, updatedAt: 0, ...extra });
const none = { dates: [], docs: [], trips: [], cards: [] };

test("dates: notify on the day and on its own remind days; list the week ahead", () => {
  const r = upcoming({ ...none, today, dates: [ev("Amma", 9, 28), ev("Appa", 9, 29), ev("Ravi", 10, 1), ev("Far", 10, 5, { remindDays: [7] }), ev("Later", 11, 20)] });
  const byId = Object.fromEntries(r.map((x) => [x.key.split(":")[1], x]));
  assert.equal(byId.Amma.notify, true);
  assert.match(byId.Amma.title, /today$/);
  assert.equal(byId.Appa.notify, true); // 1 day before
  assert.equal(byId.Ravi.notify, false); // 3 days — listed, not a remind day
  assert.equal(byId.Far.notify, true); // 7 days before, its remind day
  assert.equal(byId.Later, undefined);
});

test("documents: 30/14/7/3/1/0 days; overdue nudged on Mondays only", () => {
  const docs = [
    { id: "a", name: "Car insurance", expiryDate: "2026-10-05", expiryLabel: "renew" }, // 7 days
    { id: "b", name: "Passport", expiryDate: "2026-10-03" }, // 5 days
    { id: "c", name: "Old PUC", expiryDate: "2026-09-20" }, // overdue
    { id: "d", name: "Archived", expiryDate: "2026-09-28", archived: true },
  ];
  const r = upcoming({ ...none, today, docs });
  const by = Object.fromEntries(r.map((x) => [x.key.split(":")[1], x]));
  assert.equal(by.a.notify, true);
  assert.match(by.a.title, /Car insurance renews in 7 days/);
  assert.equal(by.b.notify, false);
  assert.equal(by.c.notify, true); // Monday
  assert.equal(by.d, undefined);
  const tuesday = upcoming({ ...none, today: { y: 2026, m: 9, d: 29 }, docs });
  assert.equal(tuesday.find((x) => x.key.startsWith("doc:c")).notify, false);
});

test("trips: countdown days, open to-dos, due to-dos and today's bookings", () => {
  const trip = {
    id: "t", name: "Goa", startDate: "2026-10-01",
    todos: [{ id: "1", text: "Book cab", due: "2026-09-28", done: false }, { id: "2", text: "Pack", done: false }, { id: "3", text: "Leave", done: true }],
    bookings: [{ id: "b", title: "Train to Goa", date: "2026-09-29", time: "06:10" }],
  };
  const r = upcoming({ ...none, today, trips: [trip] });
  const start = r.find((x) => x.key.startsWith("trip:"));
  assert.equal(start.notify, true); // 3 days before
  assert.equal(start.detail, "2 to-dos still open");
  assert.ok(r.some((x) => x.title === "Book cab — due today" && x.notify));
  assert.ok(r.some((x) => x.title === "Train to Goa tomorrow at 06:10" && x.notify));
});

test("cards: listed when owed, nudged on the 1st and 15th", () => {
  const cards = [{ id: "c", name: "HDFC", outstandingPaise: 1234500 }, { id: "z", name: "Paid off", outstandingPaise: 0 }];
  const r = upcoming({ ...none, today, cards });
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "₹12,345 still owed on HDFC");
  assert.equal(r[0].notify, false);
  assert.equal(upcoming({ ...none, today: { y: 2026, m: 10, d: 1 }, cards })[0].notify, true);
});

test("digest: one message, most pressing first, capped", () => {
  assert.equal(digestMessage([]), null);
  const items = upcoming({ ...none, today, dates: [ev("A", 9, 28), ev("B", 9, 29), ev("C", 10, 5, { remindDays: [7] })], cards: [] }).filter((x) => x.notify);
  const m = digestMessage(items);
  assert.equal(m.title, "Today · 3 reminders");
  assert.equal(m.body.split("\n")[0], "A's birthday today");
  const many = Array.from({ length: 6 }, (_, i) => ({ ...items[0], title: `x${i}` }));
  assert.match(digestMessage(many).body, /\+2 more$/);
});

test("budgets: from 80% listed and nudged once; 100% is its own nudge", () => {
  const b = (spent) => ({ group: "Food", monthKey: "2026-09", spentPaise: spent, budgetPaise: 1000000 });
  assert.equal(upcoming({ ...none, today, budgets: [b(700000)] }).length, 0);
  const at86 = upcoming({ ...none, today, budgets: [b(860000)] })[0];
  assert.equal(at86.title, "Food budget 86% used");
  assert.equal(at86.detail, "₹8,600 of ₹10,000 this month");
  assert.equal(at86.once, true);
  const over = upcoming({ ...none, today, budgets: [b(1120000)] })[0];
  assert.equal(over.title, "Food budget over by ₹1,200");
  assert.notEqual(at86.key, over.key);
});

test("health: refills and check-ups a week, a day and on the day", () => {
  const h = (id, nextDate, extra = {}) => ({ id, person: "vamsi", personName: "Vamsi", kind: "medicine", title: "Thyronorm", nextDate, ...extra });
  const r = upcoming({ ...none, today, health: [h("a", "2026-10-05"), h("b", "2026-10-01"), h("c", "2026-09-29", { kind: "visit", title: "Dentist" }), h("d", "2026-10-02", { active: false })] });
  const by = Object.fromEntries(r.map((x) => [x.key.split(":")[1], x]));
  assert.equal(by.a.notify, true);
  assert.match(by.a.title, /Vamsi: Thyronorm refill in 7 days/);
  assert.equal(by.b.notify, false);
  assert.equal(by.c.title, "Vamsi: Dentist check-up tomorrow");
  assert.equal(by.d, undefined);
});
