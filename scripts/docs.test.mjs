// Pure tests for Documents folder helpers. Run: npm run test:docs
import { test } from "node:test";
import assert from "node:assert/strict";
import { descendants, folderChain, folderOptions, folderPath } from "../src/lib/docFolders.ts";

const f = (id, name, parentId = null) => ({ id, name, parentId, createdBy: "x", createdAt: 0 });
const folders = [f("tcs", "TCS docs"), f("pay", "Payslips", "tcs"), f("pf", "PF", "tcs"), f("y24", "2024", "pay"), f("home", "Home")];

test("path and chain", () => {
  assert.equal(folderPath(folders, "y24"), "TCS docs / Payslips / 2024");
  assert.deepEqual(folderChain(folders, "pf").map((x) => x.id), ["tcs", "pf"]);
  assert.equal(folderPath(folders, null), "");
});

test("descendants include every level", () => {
  assert.deepEqual([...descendants(folders, "tcs")].sort(), ["pay", "pf", "tcs", "y24"]);
  assert.deepEqual([...descendants(folders, "home")], ["home"]);
});

test("select options are depth-first and indented", () => {
  const o = folderOptions(folders);
  assert.deepEqual(o.map((x) => [x.id, x.depth]), [["home", 0], ["tcs", 0], ["pay", 1], ["y24", 2], ["pf", 1]]);
  assert.match(o[2].label, /↳ Payslips$/);
});

test("a broken cycle doesn't loop forever", () => {
  const cyc = [f("a", "A", "b"), f("b", "B", "a")];
  assert.equal(folderChain(cyc, "a").length, 2);
});
