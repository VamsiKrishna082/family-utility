import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { geocodeCity } from "@/lib/trips/geo";
import { addDays, daysBetween, todayIST } from "@/lib/trips/logic";
import { getTrip, tripsCol } from "@/lib/trips/store";
import type { TripWeatherResponse, WeatherDay } from "@/lib/trips/types";

export const runtime = "nodejs";

/**
 * GET — forecast for the destination on the trip's days (Open-Meteo, free,
 * no key). Forecasts only reach ~16 days ahead, so further-off trips get a
 * note instead; the destination's coordinates are cached on the trip.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.destination.trim()) return ok({ place: null, days: [], note: "Add a destination to see the weather." } satisfies TripWeatherResponse);
    if (!trip.startDate || !trip.endDate) return ok({ place: trip.destination, days: [], note: "Set the dates to see the forecast." } satisfies TripWeatherResponse);

    const today = todayIST();
    const horizon = addDays(today, 15);
    if (trip.startDate > horizon) {
      return ok({ place: trip.destination, days: [], note: `Forecast opens ${daysBetween(today, trip.startDate) - 15} days from now (about 2 weeks before you go).` } satisfies TripWeatherResponse);
    }
    if (trip.endDate < today) return ok({ place: trip.destination, days: [], note: "This trip is over." } satisfies TripWeatherResponse);

    let geo = trip.geo && trip.geo.name === trip.destination ? trip.geo : null;
    if (!geo) {
      geo = await geocodeCity(trip.destination);
      if (!geo) return ok({ place: trip.destination, days: [], note: `Couldn't find "${trip.destination}" on the map.` } satisfies TripWeatherResponse);
      await tripsCol().doc(id).update({ geo });
    }

    const start = trip.startDate < today ? today : trip.startDate;
    const end = trip.endDate > horizon ? horizon : trip.endDate;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&start_date=${start}&end_date=${end}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const d = (await r.json()) as { daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] } };
    const days: WeatherDay[] = (d.daily?.time ?? []).map((date, i) => ({
      date,
      code: d.daily!.weather_code[i],
      max: Math.round(d.daily!.temperature_2m_max[i]),
      min: Math.round(d.daily!.temperature_2m_min[i]),
      rainPct: d.daily!.precipitation_probability_max[i] ?? 0,
    }));
    return ok({ place: trip.destination, days } satisfies TripWeatherResponse);
  } catch (e) {
    return fail(e);
  }
}
