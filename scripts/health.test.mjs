// Pure tests for Health records. Run: npm run test:health
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, comingUp, markDone } from "../src/lib/health.ts";

test("addDays crosses months and years", () => {
  assert.equal(addDays("2026-09-27", 30), "2026-10-27");
  assert.equal(addDays("2026-12-20", 15), "2027-01-04");
});

test("Done sets today and the next date from the repeat", () => {
  assert.deepEqual(markDone({ everyDays: 30, nextDate: "2026-09-20" }, "2026-09-27"), { date: "2026-09-27", nextDate: "2026-10-27" });
  assert.deepEqual(markDone({ nextDate: "2026-09-20" }, "2026-09-27"), { date: "2026-09-27" });
});

test("coming up: soonest first, overdue included, stopped medicines and far dates left out", () => {
  const i = (id, nextDate, extra = {}) => ({ id, person: "vamsi", kind: "medicine", title: id, nextDate, createdBy: "", createdAt: 0, updatedAt: 0, ...extra });
  const r = comingUp([i("far", "2027-03-01"), i("soon", "2026-10-02"), i("late", "2026-09-20"), i("stopped", "2026-10-01", { active: false }), i("none", undefined)], "2026-09-27");
  assert.deepEqual(r.map((x) => x.id), ["late", "soon"]);
});
