import type { GeoPoint } from "@/lib/trips/types";

/**
 * Place lookups for the map and weather, from free, keyless services.
 * OpenStreetMap Nominatim first — it knows states and regions ("Goa") as
 * well as specific spots (beaches, forts, cafés) — searching India first
 * (most trips are domestic; a bare "Goa" otherwise matched Genoa, Italy),
 * then worldwide for trips abroad; Open-Meteo's city geocoder is the last
 * resort. Results are cached on the trip / day docs, so each name is looked
 * up once. Nominatim asks for ≤1 request/second and an identifying User-Agent.
 */
const UA = "household-app/1.0 (private family app)";
const TIMEOUT = 4000;

async function nominatim(q: string, countrycodes?: string): Promise<GeoPoint | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}${countrycodes ? `&countrycodes=${countrycodes}` : ""}`,
      { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(TIMEOUT) },
    );
    const data = (await r.json()) as { lat: string; lon: string }[];
    return data[0] ? { name: q, lat: Number(data[0].lat), lon: Number(data[0].lon) } : null;
  } catch {
    return null;
  }
}

async function openMeteo(name: string): Promise<GeoPoint | null> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = (await r.json()) as { results?: { latitude: number; longitude: number }[] };
    const hit = data.results?.[0];
    return hit ? { name, lat: hit.latitude, lon: hit.longitude } : null;
  } catch {
    return null;
  }
}

/** The trip's destination (map centre + weather). */
export async function geocodeCity(name: string): Promise<GeoPoint | null> {
  const hit = (await nominatim(name, "in")) ?? (await sleep(1100), await nominatim(name)) ?? (await openMeteo(name));
  return hit ? { ...hit, name } : null;
}

/** A place within the trip ("Chapora Fort"), searched near the destination first. */
export async function geocodePlace(query: string, near?: string): Promise<GeoPoint | null> {
  const hit = near ? await nominatim(`${query}, ${near}`) : null;
  if (hit) return { ...hit, name: query };
  // "Fort Aguada, Goa" may miss where "Fort Aguada" alone hits.
  const plain = await nominatim(query);
  return plain ? { ...plain, name: query } : null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
