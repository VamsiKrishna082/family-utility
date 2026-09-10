import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env, required } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      // Auth.js v5 would otherwise look for AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
      // We pass them explicitly so one pair of env vars serves both the app and
      // scripts/drive-token.mjs, which use the same OAuth client.
      clientId: required("GOOGLE_CLIENT_ID"),
      clientSecret: required("GOOGLE_CLIENT_SECRET"),
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    // The allowlist. Anyone not on it never gets a session at all.
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      if (profile?.email_verified === false) return false;
      return env.allowedEmails.includes(email);
    },
    // Guards every non-public route via middleware.
    authorized({ auth: session }) {
      return !!session?.user?.email;
    },
    jwt({ token, profile }) {
      if (profile?.email) {
        token.email = profile.email;
        token.name = profile.name ?? token.name;
        token.picture = profile.picture ?? token.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.email) session.user.email = token.email;
      return session;
    },
  },
});

/** Throws if there is no signed-in, allowlisted user. Use at the top of every API route. */
export async function requireUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !env.allowedEmails.includes(email)) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return { email, name: session!.user!.name ?? email };
}
