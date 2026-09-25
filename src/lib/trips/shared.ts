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
