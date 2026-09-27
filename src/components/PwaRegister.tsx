"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Registers the service worker (public/sw.js) — in production only, so the
 * dev server's hot reload never fights a cache. For local testing of
 * install/offline/push, run `localStorage.setItem("sw-dev", "1")` and reload.
 * On the sign-in page (where "Sign out" lands) it clears everything the
 * device kept, so private pages don't stay cached after signing out.
 */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let devOptIn = false;
    try { devOptIn = localStorage.getItem("sw-dev") === "1"; } catch { /* private mode */ }
    if (process.env.NODE_ENV !== "production" && !devOptIn) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (pathname !== "/signin" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "clear-caches" })).catch(() => undefined);
  }, [pathname]);

  return null;
}
