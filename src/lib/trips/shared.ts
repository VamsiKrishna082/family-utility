import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/firestore";
import { listFolder } from "@/lib/drive";
import { daysCol, emptyDay, normalizeTrip, readDay } from "@/lib/trips/store";
import type { Trip, TripDay } from "@/lib/trips/types";
import type { Entry } from "@/lib/types";

/** Looks a trip up by its share token (constant-time compare on the match). Null if sharing is off or the token is wrong. */
export async function tripByShareToken(token: string): Promise<Trip | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const snap = await db().collection("trips").where("shareToken", "==", token).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const trip = doc.data() as Trip;
  const a = Buffer.from(token);
  const b = Buffer.from(trip.shareToken ?? "");
  return a.length === b.length && timingSafeEqual(a, b) ? normalizeTrip(trip) : null;
}

/** Every day of the trip (1…days), empty ones filled in — a day with nothing saved yet has no record. */
export async function sharedDays(trip: Trip): Promise<TripDay[]> {
  const snap = await daysCol(trip.id).get();
  const byNum = new Map(snap.docs.map((d) => readDay(d.data())).map((d) => [d.day, d]));
  return Array.from({ length: trip.days }, (_, i) => byNum.get(i + 1) ?? emptyDay(trip.id, i + 1));
}

/** Photos (not videos, not folders) in a day's linked Album folder, oldest first like a camera roll. */
export async function dayPhotos(day: TripDay): Promise<Entry[]> {
  if (!day.folderId) return [];
  try {
    const entries = await listFolder(day.folderId);
    return entries.filter((e) => e.kind === "photo").sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  } catch {
    return [];
  }
}

/**
 * Which photos a share link may show — worked out once per link and kept for
 * 10 minutes. Printing the journal loads every photo at once (100+ requests);
 * without this each one re-read the trip and re-listed every day folder in
 * Drive, and any listing that failed under that load turned into a 404.
 * Requests arriving together share one lookup, and a failed lookup isn't
 * kept, so the next request simply tries again.
 */
const ALLOWED_TTL = 10 * 60_000;
const allowed = new Map<string, { at: number; ids: Promise<Set<string> | null> }>();

async function lookUpAllowed(token: string): Promise<Set<string> | null> {
  const trip = await tripByShareToken(token);
  if (!trip) return null;
  const days = await sharedDays(trip);
  const ids = new Set<string>();
  for (const d of days) {
    if (!d.folderId) continue;
    // listFolder throws on a Drive error — deliberately not swallowed here.
    for (const e of await listFolder(d.folderId)) if (e.kind === "photo") ids.add(e.id);
  }
  return ids;
}

/** true / false, or throws when Drive couldn't be asked right now (→ 503, not 404). */
export async function sharedPhotoAllowed(token: string, photoId: string): Promise<boolean> {
  const get = (fresh: boolean) => {
    const hit = allowed.get(token);
    if (hit && !fresh && Date.now() - hit.at < ALLOWED_TTL) return hit;
    const entry = { at: Date.now(), ids: lookUpAllowed(token) };
    entry.ids.catch(() => { if (allowed.get(token) === entry) allowed.delete(token); });
    if (allowed.size > 200) allowed.delete(allowed.keys().next().value!);
    allowed.set(token, entry);
    return entry;
  };
  const first = get(false);
  const ids = await first.ids;
  if (!ids) return false;
  if (ids.has(photoId)) return true;
  // A photo added to a day folder since the lookup: refresh once (at most once a minute).
  if (Date.now() - first.at < 60_000) return false;
  return (await get(true).ids)?.has(photoId) ?? false;
}
