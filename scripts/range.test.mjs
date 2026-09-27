// Pure tests for capped byte ranges (Cloud Run's 32 MiB response limit). Run: npm run test:range
import { test } from "node:test";
import assert from "node:assert/strict";
import { sliceFor, sliceHeaders } from "../src/lib/range.ts";

const MB = 1024 * 1024;
const size = 50 * MB;

test("open-ended range from a player is capped to one slice", () => {
  assert.deepEqual(sliceFor("bytes=0-", size), { start: 0, end: 8 * MB - 1, partial: true });
  assert.deepEqual(sliceFor("bytes=40000000-", size), { start: 40000000, end: 40000000 + 8 * MB - 1, partial: true });
});

test("a slice never runs past the end of the file", () => {
  assert.deepEqual(sliceFor(`bytes=${size - 10}-`, size), { start: size - 10, end: size - 1, partial: true });
  assert.deepEqual(sliceFor("bytes=0-99999999999", 1000), { start: 0, end: 999, partial: true });
});

test("small explicit ranges pass through; suffix ranges work", () => {
  assert.deepEqual(sliceFor("bytes=0-1", size), { start: 0, end: 1, partial: true });
  assert.deepEqual(sliceFor("bytes=-500", size), { start: size - 500, end: size - 1, partial: true });
});

test("no range: small files are a plain 200, big ones start with a slice", () => {
  assert.deepEqual(sliceFor(null, 1000), { start: 0, end: 999, partial: false });
  assert.equal(sliceFor(null, size).partial, true);
});

test("unsatisfiable ranges", () => {
  assert.equal(sliceFor(`bytes=${size}-`, size), null);
  assert.equal(sliceFor("bytes=5-2", size), null);
  assert.equal(sliceFor("bytes=-", size), null);
  assert.equal(sliceFor("items=0-1", size), null);
});

test("headers", () => {
  assert.deepEqual(sliceHeaders({ start: 0, end: 9, partial: true }, 100), { "Accept-Ranges": "bytes", "Content-Length": "10", "Content-Range": "bytes 0-9/100" });
  assert.deepEqual(sliceHeaders({ start: 0, end: 99, partial: false }, 100), { "Accept-Ranges": "bytes", "Content-Length": "100" });
});
