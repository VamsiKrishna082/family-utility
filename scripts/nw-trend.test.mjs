// Pure tests for the net worth trend and projection. Run: npm run test:nw
import { test } from "node:test";
import assert from "node:assert/strict";
import { fyEndMonth, pace, project, projectionAt, shiftMonth } from "../src/lib/nwTrend.ts";

const pts = [["2026-04", 100], ["2026-05", 110], ["2026-06", 130], ["2026-07", 125], ["2026-08", 150], ["2026-09", 160]].map(([monthKey, v]) => ({ monthKey, netPaise: v * 100000 }));

test("pace is the average monthly change over recent months", () => {
  assert.deepEqual(pace(pts), { perMonthPaise: 1200000, months: 5 });
  assert.equal(pace(pts.slice(0, 1)), null);
  // gaps count as months: two points 3 months apart
  assert.deepEqual(pace([{ monthKey: "2026-01", netPaise: 0 }, { monthKey: "2026-04", netPaise: 300 }]), { perMonthPaise: 100, months: 3 });
});

test("projection continues from the latest month", () => {
  const p = project(pts, 3);
  assert.deepEqual(p.map((x) => x.monthKey), ["2026-09", "2026-10", "2026-11", "2026-12"]);
  assert.equal(p[3].netPaise, 16000000 + 3 * 1200000);
});

test("financial-year end and value there", () => {
  assert.equal(fyEndMonth("2026-09"), "2027-03");
  assert.equal(fyEndMonth("2027-02"), "2027-03");
  assert.equal(projectionAt(pts, "2027-03"), 16000000 + 6 * 1200000);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});
