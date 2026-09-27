// Pure tests for the tax-season pack. Run: npm run test:tax
import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, fyLabel, fyOf, fyRange, taxChecklist, taxTotals } from "../src/lib/taxPack.ts";

test("financial year runs April to March", () => {
  assert.equal(fyOf("2026-09-27"), 2026);
  assert.equal(fyOf("2027-02-10"), 2026);
  assert.equal(fyOf("2026-04-01"), 2026);
  assert.equal(fyOf("2026-03-31"), 2025);
  assert.equal(fyLabel(2026), "FY 2026-27");
  assert.deepEqual(fyRange(2026), { from: "2026-04-01", to: "2027-03-31" });
});

test("buckets from category, sub-category and note", () => {
  assert.equal(bucketOf("expense", "Housing Rent"), "rent");
  assert.equal(bucketOf("expense", "Health Health insurance premium"), "health");
  assert.equal(bucketOf("saving", "Investments PPF"), "sec80c");
  assert.equal(bucketOf("saving", "Investments NPS tier 1"), "nps");
  assert.equal(bucketOf("saving", "Savings Mutual fund SIP"), "otherInvest");
  assert.equal(bucketOf("expense", "Insurance LIC premium"), "sec80c");
  assert.equal(bucketOf("expense", "Food Swiggy"), null);
});

test("totals only count the chosen year", () => {
  const t = (type, amountPaise, date, categoryName, subcategory) => ({ type, amountPaise, date, categoryName, subcategory });
  const r = taxTotals([
    t("income", 20000000, "2026-05-01", "Salary"),
    t("income", 20000000, "2026-03-01", "Salary"), // previous FY
    t("expense", 2500000, "2026-06-05", "Housing", "Rent"),
    t("saving", 1500000, "2026-07-01", "Investments", "PPF"),
    t("expense", 50000, "2026-07-02", "Food", "Swiggy"),
  ], 2026);
  assert.equal(r.incomeTotalPaise, 20000000);
  assert.deepEqual(r.buckets.map((b) => [b.bucket, b.totalPaise]), [["rent", 2500000], ["sec80c", 1500000]]);
});

test("checklist matches documents by name and details", () => {
  const c = taxChecklist([{ id: "1", name: "Form 16 FY25-26", text: "" }, { id: "2", name: "Vamsi PAN", text: "Identity" }, { id: "3", name: "Star Health policy", text: "Insurance" }]);
  const by = Object.fromEntries(c.map((x) => [x.key, x.docs.map((d) => d.id)]));
  assert.deepEqual(by.form16, ["1"]);
  assert.deepEqual(by["80d"], ["3"]);
  assert.deepEqual(by.ais, []);
});
