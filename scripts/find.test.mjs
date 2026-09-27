// Pure tests for app-wide search matching. Run: npm run test:find
import { test } from "node:test";
import assert from "node:assert/strict";
import { driveLiteral, matchesAll, snippet, terms } from "../src/lib/findText.ts";

test("every word must appear, any order and case", () => {
  assert.equal(matchesAll("Card – PAN (Vamsi)", terms("pan card")), true);
  assert.equal(matchesAll("Aadhaar card", terms("pan card")), false);
  assert.equal(matchesAll("Café Coffee Day", terms("cafe")), true);
  assert.equal(matchesAll("anything", terms("   ")), false);
});

test("snippet centres on the first hit", () => {
  const story = "We left early in the morning. After a long drive we finally reached the fort at sunset and it was beautiful.";
  const s = snippet(story, terms("fort"), 20);
  assert.match(s, /^….*fort.*…$/);
  assert.ok(s.length < 60);
});

test("drive query literal escapes quotes", () => {
  assert.equal(driveLiteral("Ravi's PAN"), "Ravi\\'s PAN");
  assert.equal(driveLiteral("a\\b"), "a\\\\b");
});
