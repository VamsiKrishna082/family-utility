// Pure tests for the Money monthly summary. Run: npm run test:money
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthInsights, sameDayLastCycle } from "../src/lib/moneyInsights.ts";

const cats = { food: "Food", fuel: "Fuel", rent: "Rent" };

test("current month compares with the same point last month; income/savings don't count as spend", () => {
  const lines = monthInsights({
    isCurrent: true,
    prevLabel: "August 2026",
    cur: { expensePaise: 0, byCategory: { food: 600000, fuel: 200000, salary: 20000000 }, incomePaise: 20000000, savingPaise: 5000000 },
    prev: { expensePaise: 0, byCategory: { food: 400000, fuel: 200000 } },
    expenseCats: cats,
  });
  assert.equal(lines[0], "₹8,000 spent so far — 33% more than by this day in August (₹6,000).");
  assert.equal(lines[1], "Food: ₹6,000, up ₹2,000 (+50%).");
  assert.equal(lines[2], "You've put 25% of income into savings.");
});

test("small moves are left out; new categories are called out; past months compare whole months", () => {
  const lines = monthInsights({
    isCurrent: false,
    prevLabel: "July 2026",
    cur: { expensePaise: 0, byCategory: { food: 410000, rent: 1500000 }, incomePaise: 0, savingPaise: 0 },
    prev: { expensePaise: 0, byCategory: { food: 400000 } },
    expenseCats: cats,
  });
  assert.equal(lines[0], "₹19,100 spent — 378% more than July (₹4,000).");
  assert.deepEqual(lines.slice(1), ["Rent: ₹15,000 — new this month."]);
});

test("nothing spent anywhere → no lines", () => {
  assert.deepEqual(monthInsights({ isCurrent: true, prevLabel: "Aug 2026", cur: { expensePaise: 0, byCategory: {}, incomePaise: 0, savingPaise: 0 }, prev: { expensePaise: 0, byCategory: {} }, expenseCats: cats }), []);
});

test("same day last cycle, clipped to that cycle's end", () => {
  assert.equal(sameDayLastCycle("2026-09-27", "2026-09-01", "2026-08-01", "2026-08-31"), "2026-08-27");
  assert.equal(sameDayLastCycle("2026-03-31", "2026-03-01", "2026-02-01", "2026-02-28"), "2026-02-28");
  assert.equal(sameDayLastCycle("2026-10-03", "2026-09-25", "2026-08-25", "2026-09-24"), "2026-09-02");
});
