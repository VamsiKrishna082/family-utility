// Pure tests for the daily good-morning and partner notifications. Run: npm run test:nudges
import { test } from "node:test";
import assert from "node:assert/strict";
import { morningMessage, partnerMessage } from "../src/lib/nudges.ts";

const r = (title, url = "/x") => ({ kind: "dates", key: title, title, detail: "", daysAway: 0, url, notify: true });

test("good morning: greets by name, lists today's reminders when there are any", () => {
  const m = morningMessage({ name: "Vamsi", date: "2026-09-28", items: [r("Amma's birthday today", "/dates#a"), r("Car insurance renews in 7 days")] });
  assert.equal(m.title, "Good morning, Vamsi ☀️");
  assert.equal(m.body, "Today:\n• Amma's birthday today\n• Car insurance renews in 7 days");
  assert.equal(m.url, "/");
  const one = morningMessage({ name: "Varshini", date: "2026-09-28", items: [r("Dentist check-up today", "/health?p=varshini")] });
  assert.equal(one.url, "/health?p=varshini");
  const many = morningMessage({ name: "V", date: "2026-09-28", items: ["a", "b", "c", "d", "e"].map((t) => r(t)) });
  assert.match(many.body, /\+2 more$/);
});

test("good morning with nothing due: a friendly line that changes daily", () => {
  const a = morningMessage({ name: "Vamsi", date: "2026-09-29", items: [] }).body; // Tuesday
  const b = morningMessage({ name: "Vamsi", date: "2026-09-30", items: [] }).body;
  assert.ok(a.length > 5);
  assert.notEqual(a, b);
  assert.match(morningMessage({ name: "Vamsi", date: "2026-09-28", items: [] }).body, /week|Monday/i); // Monday
});

test("partner nudge names the other person and rotates", () => {
  const a = partnerMessage({ partnerName: "Varshini", date: "2026-09-28" });
  const b = partnerMessage({ partnerName: "Varshini", date: "2026-09-29" });
  assert.equal(a.title, "💬 Varshini");
  assert.match(a.body, /Varshini/);
  assert.notEqual(a.body, b.body);
});
