import { serveThumb, thumbWidth } from "@/lib/thumbs";
import { sharedPhotoAllowed } from "@/lib/trips/shared";

export const runtime = "nodejs";

/**
 * GET /share/trip/<token>/photo/<id>?w=520|1600 — a photo on a shared trip
 * journal. Public by design, but only for a valid token, and only for a
 * photo that sits in one of that trip's linked day folders — the rest of
 * the Album stays private.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params;
  let ok: boolean;
  try {
    ok = await sharedPhotoAllowed(token, id);
  } catch {
    // Drive/Firestore hiccup — say "try again", never "doesn't exist".
    return new Response("Busy, try again", { status: 503, headers: { "Retry-After": "2", "Cache-Control": "no-store" } });
  }
  if (!ok) return new Response("Not found", { status: 404 });
  try {
    return await serveThumb(id, thumbWidth(Number(new URL(req.url).searchParams.get("w") ?? 520)));
  } catch {
    return new Response("Busy, try again", { status: 503, headers: { "Retry-After": "2", "Cache-Control": "no-store" } });
  }
}
