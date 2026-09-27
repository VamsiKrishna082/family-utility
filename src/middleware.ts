export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Everything except auth endpoints, the Cloud Tasks worker, the sign-in
    // page, public document-share links (the app's only deliberately
    // unauthenticated routes, alongside the Dates calendar feed at
    // /share/calendar/<token> — each does its own token check instead) and
    // static files.
    // The PWA files (service worker, manifest, icons, offline page) are public too — the
    // browser fetches them without a session, e.g. when installing or updating the worker.
    "/((?!api/auth|api/tasks|signin|share|_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|icons/|offline.html).*)",
  ],
};
