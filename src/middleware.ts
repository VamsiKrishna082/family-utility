export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Everything except auth endpoints, the Cloud Tasks worker, the sign-in
    // page, public document-share links (the app's only deliberately
    // unauthenticated route — it does its own token check instead) and
    // static files.
    "/((?!api/auth|api/tasks|signin|share|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
