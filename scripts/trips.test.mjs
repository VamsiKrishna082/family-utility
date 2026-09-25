// Pure unit tests for Trips date maths — no Firestore, no network. Run: npm run test:trips
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeUrl, settleUp, dateOfDay, dayHasContent, endDateOf, phaseOf, rangeLabel, tripStatus, tripWhen } from "../src/lib/trips/logic.ts";

test("days ↔ end date", () => {
  assert.equal(endDateOf("2026-12-30", 5), "2027-01-03");
  assert.equal(endDateOf("2026-10-01", 1), "2026-10-01");
  assert.equal(dateOfDay("2026-12-30", 3), "2027-01-01");
});

test("status and when-label follow today", () => {
  assert.equal(tripStatus("2026-10-10", "2026-10-14", "2026-09-25"), "upcoming");
  assert.equal(tripStatus("2026-09-24", "2026-09-27", "2026-09-25"), "ongoing");
  assert.equal(tripStatus("2026-09-01", "2026-09-05", "2026-09-25"), "completed");
  assert.equal(tripWhen("2026-09-24", "2026-09-27", 4, "2026-09-25"), "Day 2 of 4");
  assert.equal(tripWhen("2026-09-26", "2026-09-27", 2, "2026-09-25"), "Tomorrow");
  assert.equal(tripWhen("2026-10-10", "2026-10-14", 5, "2026-09-25"), "in 15 days");
  assert.equal(tripWhen("2026-09-01", "2026-09-05", 5, "2026-09-25"), "3 weeks ago");
});

test("expense phases around the trip", () => {
  assert.equal(phaseOf("2026-08-15", "2026-10-10", "2026-10-14"), "before");
  assert.equal(phaseOf("2026-10-12", "2026-10-10", "2026-10-14"), "during");
  assert.equal(phaseOf("2026-10-20", "2026-10-10", "2026-10-14"), "after");
});

test("range labels", () => {
  assert.equal(rangeLabel("2026-12-12", "2026-12-16"), "12 – 16 Dec 2026");
  assert.equal(rangeLabel("2026-11-29", "2026-12-02"), "29 Nov – 2 Dec 2026");
  assert.equal(rangeLabel("2026-12-30", "2027-01-02"), "30 Dec 2026 – 2 Jan 2027");
});

test("a day with anything written or linked counts as content", () => {
  assert.equal(dayHasContent({ title: "", story: "", places: [], highlight: "" }), false);
  assert.equal(dayHasContent({ title: "", story: "Beach", places: [], highlight: "" }), true);
  assert.equal(dayHasContent({ title: "", story: "", places: [], highlight: "", folderId: "abc" }), true);
});

test("ideas have no dates", () => {
  assert.equal(tripStatus(undefined, undefined, "2026-09-25"), "idea");
  assert.equal(tripWhen(undefined, undefined, 3, "2026-09-25"), "Someday");
});

test("settle up: equal splits, fewest transfers", () => {
  const { balances, transfers } = settleUp([
    { id: "1", title: "Villa", amount: 30000, paidBy: "Us", splitAmong: ["Us", "Ravi", "Priya"] },
    { id: "2", title: "Dinner", amount: 6000, paidBy: "Ravi", splitAmong: ["Us", "Ravi", "Priya"] },
  ]);
  assert.deepEqual(balances, { Us: 18000, Ravi: -6000, Priya: -12000 });
  assert.deepEqual(transfers, [{ from: "Priya", to: "Us", amount: 12000 }, { from: "Ravi", to: "Us", amount: 6000 }]);
  assert.equal(settleUp([{ id: "3", title: "Taxi", amount: 100, paidBy: "Ravi", splitAmong: ["Us", "Ravi"] }], 83.5).transfers[0].amount, 4175);
});

test("only http(s) links are rendered", () => {
  assert.equal(safeUrl("booking.com/hotel/x"), "https://booking.com/hotel/x");
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://maps.app.goo.gl/abc"), "https://maps.app.goo.gl/abc");
});
