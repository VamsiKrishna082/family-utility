import { randomBytes } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { gcsDelete, gcsDownload, gcsUpload } from "@/lib/gcs";
import { ok, fail } from "@/lib/http";
import { readUpload, serveBlob } from "@/lib/trips/blobs";
import { getTrip, HttpError, tripsCol } from "@/lib/trips/store";
import type { TripReceipt } from "@/lib/trips/types";

export const runtime = "nodejs";

const IMAGE_OR_PDF = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

/** POST ?txId=|sharedId=&name= (raw image/PDF body) — attach a receipt to the trip, optionally to one expense. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await getTrip(id);
    const url = new URL(req.url);
    const { buf, contentType } = await readUpload(req, IMAGE_OR_PDF, 10_000_000);
    const rid = randomBytes(8).toString("hex");
    const key = `trips/${id}/receipts/${rid}`;
    await gcsUpload(key, buf, contentType);
    const receipt: TripReceipt = {
      id: rid, key, contentType,
      name: (url.searchParams.get("name") ?? "receipt").slice(0, 120),
      ...(url.searchParams.get("txId") ? { txId: url.searchParams.get("txId")! } : {}),
      ...(url.searchParams.get("sharedId") ? { sharedId: url.searchParams.get("sharedId")! } : {}),
      uploadedAt: Date.now(),
      uploadedBy: user.email,
    };
    await tripsCol().doc(id).update({ receipts: FieldValue.arrayUnion(receipt), updatedAt: Date.now() });
    return ok({ receipt });
  } catch (e) {
    return fail(e);
  }
}

/** GET ?r=<id> — view a receipt. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    const r = trip.receipts.find((x) => x.id === new URL(req.url).searchParams.get("r"));
    if (!r) throw new HttpError("Receipt not found", 404);
    return serveBlob(await gcsDownload(r.key), r.contentType, r.name);
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?r=<id> */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    const rid = new URL(req.url).searchParams.get("r");
    const r = trip.receipts.find((x) => x.id === rid);
    if (!r) return ok({ deleted: false });
    await tripsCol().doc(id).update({ receipts: trip.receipts.filter((x) => x.id !== rid), updatedAt: Date.now() });
    await gcsDelete(r.key);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
