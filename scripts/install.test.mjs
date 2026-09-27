// Pure tests for the install card's device detection. Run: npm run test:install
import { test } from "node:test";
import assert from "node:assert/strict";
import { installHow, installSteps } from "../src/lib/installHow.ts";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
  whatsapp: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 WhatsApp/2.24",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

test("phones and tablets get the right steps", () => {
  assert.deepEqual(installHow(UA.iphoneSafari), { kind: "ios", browser: "safari" });
  assert.deepEqual(installHow(UA.iphoneChrome), { kind: "ios", browser: "other" });
  assert.deepEqual(installHow(UA.ipad, 5), { kind: "ios", browser: "safari" });
  assert.deepEqual(installHow(UA.androidChrome), { kind: "android", browser: "chrome" });
  assert.deepEqual(installHow(UA.samsung), { kind: "android", browser: "samsung" });
  assert.match(installSteps(installHow(UA.iphoneSafari)), /Add to Home Screen/);
  assert.match(installSteps(installHow(UA.androidChrome)), /Install app/);
});

test("in-app browsers are told to open a real browser; a Mac without touch is a desktop", () => {
  assert.deepEqual(installHow(UA.whatsapp), { kind: "in-app", app: "WhatsApp" });
  assert.match(installSteps(installHow(UA.whatsapp)), /Open in browser/);
  assert.deepEqual(installHow(UA.mac, 0), { kind: "desktop" });
});
