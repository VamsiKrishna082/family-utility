export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Everything except auth endpoints, the Cloud Tasks worker, the sign-in page and static files.
    "/((?!api/auth|api/tasks|signin|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
