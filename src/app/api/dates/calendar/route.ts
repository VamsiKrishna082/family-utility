import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const ref = () => db().collection("dates_settings").doc("main");
const newToken = () => randomBytes(24).toString("base64url");

/**
 * GET — the private token for the calendar feed (/share/calendar/<token>),
 * created on first use. Anyone with the link can read the dates (that's how
 * calendar apps subscribe), so it's long, random, and can be replaced.
 */
export async function GET() {
  try {
    await requireUser();
    const snap = await ref().get();
    let token = snap.exists ? (snap.data()!.icsToken as string | undefined) : undefined;
    if (!token) {
      token = newToken();
      await ref().set({ icsToken: token, updatedAt: Date.now() }, { merge: true });
    }
    return ok({ token });
  } catch (e) {
    return fail(e);
  }
}

/** POST — replace the token; the old link stops working immediately. */
export async function POST() {
  try {
    await requireUser();
    const token = newToken();
    await ref().set({ icsToken: token, updatedAt: Date.now() }, { merge: true });
    return ok({ token });
  } catch (e) {
    return fail(e);
  }
}
