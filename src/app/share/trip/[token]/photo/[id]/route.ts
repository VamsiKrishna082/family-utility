import { serveThumb, thumbWidth } from "@/lib/thumbs";
import { dayPhotos, sharedDays, tripByShareToken } from "@/lib/trips/shared";

export const runtime = "nodejs";

/**
 * GET /share/trip/<token>/photo/<id>?w=520|1600 — a photo on a shared trip
 * journal. Public by design, but only for a valid token, and only for a
 * photo that sits in one of that trip's linked day folders — the rest of
 * the Album stays private.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  const trip = await tripByShareToken(token);
  if (!trip) return new Response("Not found", { status: 404 });
  const days = await sharedDays(trip);
  for (const day of days) {
    if ((await dayPhotos(day)).some((p) => p.id === id)) {
      return serveThumb(id, thumbWidth(Number(new URL(req.url).searchParams.get("w") ?? 520)));
    }
  }
  return new Response("Not found", { status: 404 });
}
