import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { gcsDelete, gcsDownload, gcsUpload } from "@/lib/gcs";
import { ok, fail } from "@/lib/http";
import { readUpload, serveBlob } from "@/lib/trips/blobs";
import { getTrip, HttpError, tripsCol } from "@/lib/trips/store";

export const runtime = "nodejs";

const IMAGE = /^image\/(jpeg|png|webp|gif|avif)$/;

/**
 * POST (raw image body) — your own cover image for the trip, e.g. a photo
 * that isn't in the Album. Turned upright and resized to a 2400px WebP, then
 * kept in GCS. Replaces any earlier custom cover; picking a day photo as the
 * cover (☆ on the Journey tab) replaces it in turn.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    const { buf } = await readUpload(req, IMAGE, 25_000_000);
    let webp: Buffer;
    try {
      webp = await sharp(buf).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new HttpError("Couldn't read that image — try a JPEG or PNG", 415);
    }
    const key = `trips/${id}/cover/${randomBytes(8).toString("hex")}.webp`;
    await gcsUpload(key, webp, "image/webp");
    const coverImage = { key, updatedAt: Date.now() };
    await tripsCol().doc(id).update({ coverImage, coverPhotoId: FieldValue.delete(), coverArt: FieldValue.delete(), updatedAt: Date.now() });
    if (trip.coverImage?.key) await gcsDelete(trip.coverImage.key).catch(() => undefined);
    return ok({ coverImage });
  } catch (e) {
    return fail(e);
  }
}

/** GET — the custom cover image. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.coverImage) throw new HttpError("No custom cover", 404);
    return serveBlob(await gcsDownload(trip.coverImage.key), "image/webp");
  } catch (e) {
    return fail(e);
  }
}

/** DELETE — removes the custom cover (the trip falls back to its first photo, or none). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.coverImage) return ok({ removed: false });
    await tripsCol().doc(id).update({ coverImage: FieldValue.delete(), updatedAt: Date.now() });
    await gcsDelete(trip.coverImage.key).catch(() => undefined);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
