// Pure unit tests for the Food & activity day engine — no Firestore, no network.
// Run: npm run test:food
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDayTotals, dayStatus, loggingStreak, scaleNutrition, shiftDate } from "../src/lib/fa/day.ts";
import { burnedKcal, computeTargets } from "../src/lib/fa/targets.ts";

const entry = (kcal, protein = 0, carbs = 0, fat = 0, fibre = 0) => ({ kcal, protein, carbs, fat, fibre });

test("day totals equal a recompute from entries, after any sequence of edits", () => {
  // Simulate the API: every add/edit/delete recomputes from the current entry set.
  let entries = [entry(174, 6, 36, 0.6, 1.8), entry(138, 6.2, 18.4, 4.1, 4.8)];
  let day = computeDayTotals(entries);
  entries = [...entries, entry(84, 2.5, 11, 3.5)]; // add
  day = computeDayTotals(entries);
  entries = entries.map((e, i) => (i === 0 ? entry(232, 8, 48, 0.8, 2.4) : e)); // edit qty 3 -> 4 idli
  day = computeDayTotals(entries);
  entries = entries.filter((_, i) => i !== 1); // delete
  day = computeDayTotals(entries);

  const manual = entries.reduce((s, e) => s + e.kcal, 0);
  assert.equal(day.kcal, manual);
  assert.equal(day.entryCount, 2);
  assert.equal(day.protein, 10.5);
});

test("an empty day totals to zero", () => {
  assert.deepEqual(computeDayTotals([]), { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, entryCount: 0 });
});

test("status is neutral: not logged / on target (±10%) / over / under", () => {
  assert.equal(dayStatus({ entryCount: 0, eatenKcal: 0, burnedKcal: 0, targetKcal: 2000 }), "none");
  assert.equal(dayStatus({ entryCount: 3, eatenKcal: 2300, burnedKcal: 320, targetKcal: 2050 }), "on"); // net 1980
  assert.equal(dayStatus({ entryCount: 3, eatenKcal: 2600, burnedKcal: 0, targetKcal: 2000 }), "over");
  assert.equal(dayStatus({ entryCount: 3, eatenKcal: 1200, burnedKcal: 0, targetKcal: 2000 }), "under");
  assert.equal(dayStatus({ entryCount: 1, eatenKcal: 5000, burnedKcal: 0, targetKcal: null }), "on");
});

test("streak counts logged days and only breaks on a day with no entries", () => {
  const today = "2026-09-24";
  const logged = new Set(["2026-09-21", "2026-09-22", "2026-09-23"]);
  assert.equal(loggingStreak(logged, today, today), 3); // today not logged *yet* doesn't break it
  logged.add(today);
  assert.equal(loggingStreak(logged, today, today), 4);
  logged.delete("2026-09-22");
  assert.equal(loggingStreak(logged, today, today), 2);
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("targets respect the floors", () => {
  const base = { weightKg: 60, heightCm: 160, birthYear: 1996, sex: "female", activityFactor: 1.2 };
  const now = new Date("2026-09-24");
  const t = computeTargets({ ...base, deficitPct: 50 }, now);
  assert.equal(t.deficitPct, 20); // capped
  assert.ok(t.targetKcal >= t.bmrKcal);
  const low = computeTargets({ ...base, deficitPct: 15, manualTargetKcal: 900 }, now);
  assert.equal(low.flooredManual, true);
  assert.ok(low.targetKcal >= low.bmrKcal);
  assert.equal(computeTargets({ ...base, deficitPct: 15 }, now).proteinG, 96); // 1.6 g/kg
});

test("scaling and burn estimate", () => {
  assert.equal(scaleNutrition({ kcal: 58, protein: 2, carbs: 12, fat: 0.2, fibre: 0.6 }, 3).kcal, 174);
  assert.equal(burnedKcal({ steps: 10000, workoutMin: 0, weightKg: 70 }), 350);
  assert.ok(burnedKcal({ steps: 0, workoutMin: 30, activity: "run", weightKg: 70 }) > 250);
});

test("logging by grams scales from the food's weight per unit", () => {
  // Idli: 58 kcal per piece, a piece ≈ 40 g → 100 g ≈ 145 kcal; re-weighing 100 g → 150 g scales the same way.
  const idli = { kcal: 58, protein: 2, carbs: 12, fat: 0.2, fibre: 0.6 };
  const g100 = scaleNutrition(idli, 100 / 40);
  assert.equal(g100.kcal, 145);
  assert.equal(scaleNutrition(g100, 150 / 100).kcal, 218);
});
