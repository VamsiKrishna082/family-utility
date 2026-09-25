import { randomBytes } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { getTrip, tripsCol } from "@/lib/trips/store";

export const runtime = "nodejs";

/**
 * POST — turn on (or replace) the private read-only journal link:
 * /share/trip/<token>. It shows the trip's days, stories, places and the
 * photos in its linked day folders — nothing else (no expenses, bookings,
 * links or notes).
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const shareToken = randomBytes(24).toString("base64url");
    await tripsCol().doc(id).update({ shareToken, updatedAt: Date.now() });
    return ok({ shareToken });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE — turn sharing off; the link stops working immediately. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await tripsCol().doc(id).update({ shareToken: FieldValue.delete(), updatedAt: Date.now() });
    return ok({ shared: false });
  } catch (e) {
    return fail(e);
  }
}
