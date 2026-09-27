/* Home — service worker.
 *
 * Makes the installed app open fast and work offline for things you've
 * already opened, and shows reminder notifications.
 *   - App code, icons, fonts: cache-first (they're versioned / never change).
 *   - Pages: network-first; offline → the last copy, else /offline.html.
 *   - Documents, trips, dates, photo thumbnails (GET): network-first with
 *     the last copy kept for offline (e.g. tickets and IDs while travelling).
 *   - Money, Food, Album listings, videos and everything else: network only,
 *     so numbers are always live.
 * Bump VERSION to drop old caches after a change here.
 */
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
const MAX_PAGES = 60;
const MAX_DATA = 400;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(["/offline.html", "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES, DATA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// "Sign out" clears everything this device kept.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheName, max, fallback) {
  try {
    const response = await fetch(request);
    const size = Number(response.headers.get("content-length") || 0);
    // Only whole, successful, same-origin answers — never redirects (e.g. to sign-in) or partial video ranges.
    if (response.ok && response.status === 200 && response.type === "basic" && !response.redirected && size <= MAX_FILE_BYTES) {
      const copy = response.clone();
      caches.open(cacheName).then((c) => c.put(request, copy)).then(() => trim(cacheName, max));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallback) return (await caches.match(fallback)) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(STATIC).then((c) => c.put(request, copy));
  }
  return response;
}

const OFFLINE_DATA = [/^\/api\/docs\//, /^\/api\/trips(\/|$)/, /^\/api\/dates(\/|$|\?)/, /^\/api\/thumb\//, /^\/share\/trip\/[^/]+\/(photo|cover)/];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/stream")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, MAX_PAGES, "/offline.html"));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (OFFLINE_DATA.some((re) => re.test(url.pathname))) {
    event.respondWith(networkFirst(request, DATA, MAX_DATA));
  }
});

/* ---------------------------- Reminders (push) ---------------------------- */

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Home", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Home";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/maskable-192.png",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) {
        await c.focus();
        if ("navigate" in c) return c.navigate(target);
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});
