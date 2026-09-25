import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { geocodeCity, geocodePlace, sleep } from "@/lib/trips/geo";
import { daysCol, getTrip, readDay, tripsCol } from "@/lib/trips/store";
import type { GeoPoint, TripDay } from "@/lib/trips/types";

export const runtime = "nodejs";

const MAX_LOOKUPS_PER_CALL = 8;

/**
 * GET — map points for every place in the journal (and planned activities
 * with a place), plus the destination as the map centre. Places not yet
 * looked up are geocoded here — a few per call, 1 s apart, per Nominatim's
 * usage policy — and cached on the day doc, so the map fills in as you
 * revisit and every later load is instant.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);

    let centre = trip.geo && trip.geo.name === trip.destination ? trip.geo : null;
    if (!centre && trip.destination.trim()) {
      centre = await geocodeCity(trip.destination);
      if (centre) await tripsCol().doc(id).update({ geo: centre });
    }

    const daysSnap = await daysCol(id).get();
    const days: TripDay[] = daysSnap.docs.map((d) => readDay(d.data())).filter((d) => d.day <= trip.days);
    let lookups = 0;
    let pending = 0;
    const points: (GeoPoint & { day: number })[] = [];

    for (const day of days.sort((a, b) => a.day - b.day)) {
      const cached = new Map((day.placeGeo ?? []).map((g) => [g.name, g]));
      let changed = false;
      for (const place of day.places) {
        let g = cached.get(place);
        if (!g) {
          if (lookups >= MAX_LOOKUPS_PER_CALL) { pending++; continue; }
          if (lookups > 0) await sleep(1100);
          lookups++;
          const hit = await geocodePlace(place, trip.destination || undefined);
          // Remember misses too (lat/lon NaN is not storable, so use a 0,0 sentinel) so we don't retry forever.
          g = hit ?? { name: place, lat: 0, lon: 0 };
          cached.set(place, g);
          changed = true;
        }
        if (g.lat !== 0 || g.lon !== 0) points.push({ ...g, day: day.day });
      }
      if (changed) {
        await daysCol(id).doc(String(day.day)).update({ placeGeo: day.places.map((p) => cached.get(p)).filter(Boolean) });
      }
    }
    return ok({ centre, points, pending });
  } catch (e) {
    return fail(e);
  }
}
