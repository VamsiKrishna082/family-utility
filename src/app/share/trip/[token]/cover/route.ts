import { gcsDownload } from "@/lib/gcs";
import { serveBlob } from "@/lib/trips/blobs";
import { tripByShareToken } from "@/lib/trips/shared";

export const runtime = "nodejs";

/** GET /share/trip/<token>/cover — the trip's custom cover image on its shared journal. Only for a valid token. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const trip = await tripByShareToken(token);
  if (!trip?.coverImage) return new Response("Not found", { status: 404 });
  return serveBlob(await gcsDownload(trip.coverImage.key), "image/webp");
}
