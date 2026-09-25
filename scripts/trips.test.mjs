// Pure unit tests for Trips date maths — no Firestore, no network. Run: npm run test:trips
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetBucket, directionsLink, docProblem, gapAfter, headCount, matchFolders, timelineClashes, upiLink, wrapUp, safeUrl, settleUp, dateOfDay, dayHasContent, endDateOf, phaseOf, rangeLabel, tripStatus, tripWhen } from "../src/lib/trips/logic.ts";

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

test("settlements reduce what's owed", () => {
  const costs = [{ id: "1", title: "Villa", amount: 30000, paidBy: "Us", splitAmong: ["Us", "Ravi", "Priya"] }];
  const { transfers } = settleUp(costs, 1, [{ id: "s", from: "Ravi", to: "Us", amount: 10000, date: "2026-09-25" }]);
  assert.deepEqual(transfers, [{ from: "Priya", to: "Us", amount: 10000 }]);
});

test("timeline clashes and gaps", () => {
  const items = [
    { id: "a", time: "09:00", durationMin: 120, title: "Fort" },
    { id: "b", time: "10:30", title: "Breakfast" },
    { id: "c", time: "15:00", title: "Beach" },
  ];
  const clashes = timelineClashes(items);
  assert.equal(clashes.get("b"), "Fort");
  assert.equal(clashes.has("c"), false);
  assert.equal(gapAfter(items[1], items[2]), 210);
});

test("directions, heads, buckets, UPI", () => {
  assert.equal(directionsLink(["A"]), null);
  assert.match(directionsLink(["Fort", "Beach", "Cafe"], "Goa"), /origin=Fort%2C\+Goa&destination=Cafe%2C\+Goa.*waypoints=Beach%2C\+Goa/);
  assert.equal(headCount(["Us", "Ravi", "Priya"]), 4);
  assert.equal(headCount(["Us"]), 2);
  assert.equal(budgetBucket("Travel", "Stays"), "stay");
  assert.equal(budgetBucket("Transport", "Fuel"), "travel");
  assert.equal(budgetBucket("Food & dining", "Dining out"), "food");
  assert.equal(budgetBucket("Electronics", "Tripod"), "shopping");
  assert.equal(budgetBucket("Miscellaneous", "Tripod"), "other");
  assert.equal(budgetBucket("Fees", "Business registration"), "other");
  assert.match(upiLink("ravi@okicici", "Ravi", 6000, "Goa trip"), /^upi:\/\/pay\?pa=ravi%40okicici&pn=Ravi&am=6000\.00&cu=INR&tn=Goa\+trip$/);
});

test("passport check", () => {
  assert.equal(docProblem("2026-01-01", "2026-12-10", "2026-09-25"), "expired");
  assert.equal(docProblem("2026-12-05", "2026-12-10", "2026-09-25"), "expires_during");
  assert.equal(docProblem("2027-03-01", "2026-12-10", "2026-09-25"), "under_6_months");
  assert.equal(docProblem("2030-01-01", "2026-12-10", "2026-09-25"), null);
});

test("folder suggestions by photo date", () => {
  const s = matchFolders([{ day: 1, date: "2026-08-06" }, { day: 2, date: "2026-08-07" }], [
    { folderId: "f1", folderName: "Bangalore", path: "Trips/Bangalore", photoDates: ["2026-08-06", "2026-08-06", "2026-08-07"] },
    { folderId: "f2", folderName: "Day 2", path: "Trips/Day 2", photoDates: ["2026-08-07", "2026-08-07"] },
  ]);
  assert.deepEqual(s.map((x) => [x.day, x.folderId, x.photosOnDay]), [[1, "f1", 2], [2, "f2", 2], [2, "f1", 1]]);
});

test("wrap-up", () => {
  const d = (day, extra = {}) => ({ tripId: "t", day, title: "", story: "", places: [], highlight: "", updatedAt: 0, updatedBy: "", ...extra });
  const w = wrapUp([d(1, { story: "x", rating: 4, mood: "😊", places: ["Fort", "Beach"] }), d(2, { rating: 5, highlight: "Sunset", places: ["beach"] })], { 1: 10, 2: 5 });
  assert.deepEqual([w.days, w.daysWritten, w.places, w.photos, w.bestDay, w.moods, w.highlights.length], [2, 1, 2, 15, 2, ["😊"], 1]);
});
