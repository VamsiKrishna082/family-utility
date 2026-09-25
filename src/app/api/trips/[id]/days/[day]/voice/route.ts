import { randomBytes } from "node:crypto";
import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { gcsDelete, gcsDownload, gcsUpload } from "@/lib/gcs";
import { ok, fail } from "@/lib/http";
import { readUpload, serveBlob } from "@/lib/trips/blobs";
import { daysCol, getTrip, HttpError, readDay } from "@/lib/trips/store";
import type { VoiceNote } from "@/lib/trips/types";

export const runtime = "nodejs";

const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|wav)$/;

async function dayOf(id: string, dayStr: string) {
  const trip = await getTrip(id);
  const day = Number(dayStr);
  if (!Number.isInteger(day) || day < 1 || day > trip.days) throw new HttpError("No such day in this trip");
  return day;
}

/** POST (raw audio body, header x-duration seconds) — a voice note for the day, stored in GCS. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; day: string }> }) {
  try {
    const user = await requireUser();
    const { id, day: dayStr } = await ctx.params;
    const day = await dayOf(id, dayStr);
    const { buf, contentType } = await readUpload(req, AUDIO, 12_000_000);
    const noteId = randomBytes(8).toString("hex");
    const key = `trips/${id}/voice/${day}-${noteId}`;
    await gcsUpload(key, buf, contentType);
    const note: VoiceNote = { id: noteId, key, contentType, durationSec: Math.max(0, Math.round(Number(req.headers.get("x-duration")) || 0)), createdAt: Date.now(), by: user.email };
    await daysCol(id).doc(String(day)).set({ tripId: id, day, voice: FieldValue.arrayUnion(note), updatedAt: Date.now(), updatedBy: user.email }, { merge: true });
    return ok({ note });
  } catch (e) {
    return fail(e);
  }
}

/** GET ?note=<id> — play a voice note. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; day: string }> }) {
  try {
    await requireUser();
    const { id, day: dayStr } = await ctx.params;
    const day = await dayOf(id, dayStr);
    const noteId = new URL(req.url).searchParams.get("note");
    const snap = await daysCol(id).doc(String(day)).get();
    const note = readDay(snap.data() ?? { tripId: id, day }).voice?.find((v) => v.id === noteId);
    if (!note) throw new HttpError("Voice note not found", 404);
    return serveBlob(await gcsDownload(note.key), note.contentType);
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?note=<id> */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; day: string }> }) {
  try {
    const user = await requireUser();
    const { id, day: dayStr } = await ctx.params;
    const day = await dayOf(id, dayStr);
    const noteId = new URL(req.url).searchParams.get("note");
    const ref = daysCol(id).doc(String(day));
    const d = readDay((await ref.get()).data() ?? { tripId: id, day });
    const note = d.voice?.find((v) => v.id === noteId);
    if (!note) return ok({ deleted: false });
    await ref.update({ voice: (d.voice ?? []).filter((v) => v.id !== noteId), updatedAt: Date.now(), updatedBy: user.email });
    await gcsDelete(note.key);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
