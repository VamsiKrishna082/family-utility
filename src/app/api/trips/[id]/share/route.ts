import { randomBytes } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { getTrip, tripsCol } from "@/lib/trips/store";

export const runtime = "nodejs";

const Expiry = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]).optional() });
const expiryFields = (days: 1 | 7 | 30 | null | undefined) =>
  days
    ? { shareExpiresAt: Date.now() + days * 86_400_000, shareDays: days }
    : { shareExpiresAt: FieldValue.delete(), shareDays: FieldValue.delete() };

/**
 * POST { days? } — turn on (or replace) the private read-only journal link:
 * /share/trip/<token>, optionally expiring after 1, 7 or 30 days (default:
 * until turned off). It shows the trip's days, stories, places and the
 * photos in its linked day folders — nothing else (no expenses, bookings,
 * links or notes).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const { days } = Expiry.parse(await req.json().catch(() => ({})));
    const shareToken = randomBytes(24).toString("base64url");
    await tripsCol().doc(id).update({ shareToken, ...expiryFields(days), updatedAt: Date.now() });
    return ok({ shareToken });
  } catch (e) {
    return fail(e);
  }
}

/** PATCH { days } — change how long the current link lasts, without changing the link. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.shareToken) throw new Error("Sharing is off for this trip");
    const { days } = Expiry.parse(await req.json());
    await tripsCol().doc(id).update({ ...expiryFields(days), updatedAt: Date.now() });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE — turn sharing off; the link stops working immediately. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await tripsCol().doc(id).update({ shareToken: FieldValue.delete(), shareExpiresAt: FieldValue.delete(), shareDays: FieldValue.delete(), updatedAt: Date.now() });
    return ok({ shared: false });
  } catch (e) {
    return fail(e);
  }
}
