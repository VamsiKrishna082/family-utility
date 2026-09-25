import type { GeoPoint } from "@/lib/trips/types";

/**
 * Place lookups for the map and weather, from free, keyless services:
 * Open-Meteo's geocoder for towns/cities (the trip's destination), and
 * OpenStreetMap Nominatim for specific places (beaches, forts, cafés).
 * Results are cached on the trip / day docs, so each name is looked up once.
 * Nominatim asks for ≤1 request/second and an identifying User-Agent.
 */
const UA = "household-app/1.0 (private family app)";
const TIMEOUT = 4000;

export async function geocodeCity(name: string): Promise<GeoPoint | null> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = (await r.json()) as { results?: { name: string; latitude: number; longitude: number }[] };
    const hit = data.results?.[0];
    return hit ? { name, lat: hit.latitude, lon: hit.longitude } : await geocodePlace(name);
  } catch {
    return null;
  }
}

export async function geocodePlace(query: string, near?: string): Promise<GeoPoint | null> {
  try {
    const q = near ? `${query}, ${near}` : query;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = (await r.json()) as { lat: string; lon: string }[];
    if (data[0]) return { name: query, lat: Number(data[0].lat), lon: Number(data[0].lon) };
    // "Fort Aguada, Goa" may miss where "Fort Aguada" alone hits.
    return near ? geocodePlace(query) : null;
  } catch {
    return null;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
