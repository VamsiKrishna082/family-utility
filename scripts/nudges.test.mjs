// Pure tests for the daily good-morning, afternoon and good-night notifications. Run: npm run test:nudges
import { test } from "node:test";
import assert from "node:assert/strict";
import { morningMessage, nightMessage, partnerMessage } from "../src/lib/nudges.ts";

const r = (title, url = "/x") => ({ kind: "dates", key: title, title, detail: "", daysAway: 0, url, notify: true });

test("good morning: greets by name, lists today's reminders, ends with love from the partner", () => {
  const m = morningMessage({ name: "Vamsi", partnerName: "Varshini", date: "2026-09-28", items: [r("Amma's birthday today", "/dates#a"), r("Car insurance renews in 7 days")] });
  assert.equal(m.title, "Good morning, Vamsi ☀️");
  assert.equal(m.body, "Today:\n• Amma's birthday today\n• Car insurance renews in 7 days\nLove you ❤️ — Varshini");
  assert.equal(m.url, "/");
  const one = morningMessage({ name: "Varshini", partnerName: "Vamsi", date: "2026-09-28", items: [r("Dentist check-up today", "/health?p=varshini")] });
  assert.equal(one.url, "/health?p=varshini");
  assert.match(one.body, /Love you ❤️ — Vamsi$/);
  const many = morningMessage({ name: "V", date: "2026-09-28", items: ["a", "b", "c", "d", "e"].map((t) => r(t)) });
  assert.match(many.body, /\+2 more$/); // no partner → no love line
});

test("good morning with nothing due: a friendly line that changes daily", () => {
  const a = morningMessage({ name: "Vamsi", partnerName: "Varshini", date: "2026-09-29", items: [] }).body; // Tuesday
  const b = morningMessage({ name: "Vamsi", partnerName: "Varshini", date: "2026-09-30", items: [] }).body;
  assert.notEqual(a, b);
  assert.match(a, /\nLove you ❤️ — Varshini$/);
  assert.match(morningMessage({ name: "Vamsi", date: "2026-09-28", items: [] }).body, /week|Monday/i); // Monday
});

test("afternoon check-in names the other person, rotates, and says love you", () => {
  const a = partnerMessage({ partnerName: "Varshini", date: "2026-09-28" });
  const b = partnerMessage({ partnerName: "Varshini", date: "2026-09-29" });
  assert.equal(a.title, "💬 Varshini");
  assert.match(a.body, /Varshini/);
  assert.match(a.body, /Love you ❤️ — Varshini$/);
  assert.notEqual(a.body, b.body);
});

test("good night: by name, weekend lines, love from the partner", () => {
  const n = nightMessage({ name: "Varshini", partnerName: "Vamsi", date: "2026-09-29" });
  assert.equal(n.title, "Good night, Varshini 🌙");
  assert.match(n.body, /\nLove you ❤️ — Vamsi$/);
  assert.match(nightMessage({ name: "V", date: "2026-10-02" }).body, /Friday/); // a Friday
  assert.notEqual(nightMessage({ name: "V", date: "2026-09-29" }).body, nightMessage({ name: "V", date: "2026-09-30" }).body);
});
