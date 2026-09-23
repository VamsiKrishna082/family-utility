import { db } from "@/lib/firestore";
import type { NwGoldItem, NwGoldRate } from "@/lib/types";

const TROY_OUNCE_GRAMS = 31.1034768;

// Generous sanity bounds (paise per gram, 24k) — wide enough to not need
// updating as prices move over the years, tight enough to reject an obviously
// broken parse (a mis-scraped 0, or a stray unrelated number) rather than
// silently caching garbage for the whole day.
const MIN_24K_PAISE = 500000; // ₹5,000/g
const MAX_24K_PAISE = 3000000; // ₹30,000/g

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function karatRates(per24kGramPaise: number, per22kGramPaise?: number, per18kGramPaise?: number) {
  return {
    per24kGramPaise,
    per22kGramPaise: per22kGramPaise ?? Math.round(per24kGramPaise * (22 / 24)),
    per18kGramPaise: per18kGramPaise ?? Math.round(per24kGramPaise * (18 / 24)),
  };
}

function inBounds(paise: number): boolean {
  return paise >= MIN_24K_PAISE && paise <= MAX_24K_PAISE;
}

function rupeesStringToPaise(s: string): number {
  return Math.round(Number(s.replace(/,/g, "")) * 100);
}

/**
 * Chennai retail gold rate, not international spot — the user specifically
 * asked for this because local jeweller prices "vary vastly" from spot.
 * Unofficial: scrapes GoodReturns' Chennai gold-rate page, which publishes
 * a fixed-format sentence with all three karat rates. Fragile by nature (any
 * page redesign breaks the regex) — every parsed value is range-checked
 * before use, and any failure just falls through to the international
 * fallback or the last cached rate rather than caching something wrong.
 */
async function fetchChennaiGoldRate(): Promise<{ per24k: number; per22k: number; per18k: number } | null> {
  try {
    const res = await fetch("https://www.goodreturns.in/gold-rates/chennai.html", {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; household-app/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const pattern = /([\d,]{4,7})<\/strong>\s*per gram for (24|22|18) karat/g;
    const found: Partial<Record<24 | 22 | 18, number>> = {};
    for (const m of html.matchAll(pattern)) {
      const karatNum = Number(m[2]) as 24 | 22 | 18;
      found[karatNum] = rupeesStringToPaise(m[1]);
    }
    if (!found[24] || !found[22] || !found[18]) return null;
    if (!inBounds(found[24]) || !inBounds(found[22]) || !inBounds(found[18])) return null;
    return { per24k: found[24], per22k: found[22], per18k: found[18] };
  } catch {
    return null;
  }
}

/**
 * Fallback only — international spot XAU converted to INR via free, no-key
 * public endpoints. Used when the Chennai-specific scrape fails, since a
 * rough number beats none, but it will read noticeably lower than local
 * retail (no import duty/GST/dealer margin baked in).
 */
async function fetchInternationalGoldRate(): Promise<number | null> {
  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" }),
      fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
    ]);
    if (!goldRes.ok || !fxRes.ok) return null;
    const gold = (await goldRes.json()) as { price?: number };
    const fx = (await fxRes.json()) as { rates?: Record<string, number> };
    const usdPerOunce = gold.price;
    const usdToInr = fx.rates?.INR;
    if (typeof usdPerOunce !== "number" || typeof usdToInr !== "number") return null;
    const inrPerGram = (usdPerOunce * usdToInr) / TROY_OUNCE_GRAMS;
    const paise = Math.round(inrPerGram * 100);
    return inBounds(paise) ? paise : null;
  } catch {
    return null;
  }
}

/**
 * Returns today's rate, fetching+caching only if nothing is cached yet for
 * today. Tries the Chennai-specific rate first, falls back to international
 * spot, and if both fail falls back to the most recent previously-cached day
 * rather than showing nothing.
 */
export async function getGoldRate(): Promise<NwGoldRate | null> {
  const date = todayInIndia();
  const ref = db().collection("nw_prices").doc(date);
  const existing = await ref.get();
  if (existing.exists) return existing.data() as NwGoldRate;

  const chennai = await fetchChennaiGoldRate();
  if (chennai) {
    const rate: NwGoldRate = { date, ...karatRates(chennai.per24k, chennai.per22k, chennai.per18k), source: "chennai", fetchedAt: Date.now() };
    await ref.set(rate);
    return rate;
  }

  const per24k = await fetchInternationalGoldRate();
  if (per24k) {
    const rate: NwGoldRate = { date, ...karatRates(per24k), source: "international", fetchedAt: Date.now() };
    await ref.set(rate);
    return rate;
  }

  const recent = await db().collection("nw_prices").orderBy("date", "desc").limit(1).get();
  return recent.empty ? null : (recent.docs[0].data() as NwGoldRate);
}

/** networth.md: "Let the user override the rate, since jewellery and coins price differently." Overwrites today's cached rate; the next day's first read fetches live again. */
export async function setManualGoldRate(per24kGramPaise: number): Promise<NwGoldRate> {
  const date = todayInIndia();
  const rate: NwGoldRate = { date, ...karatRates(per24kGramPaise), source: "manual", fetchedAt: Date.now() };
  await db().collection("nw_prices").doc(date).set(rate);
  return rate;
}

export function goldItemValuePaise(karat: 24 | 22 | 18, grams: number, rate: NwGoldRate): number {
  const perGram = karat === 24 ? rate.per24kGramPaise : karat === 22 ? rate.per22kGramPaise : rate.per18kGramPaise;
  return Math.round(perGram * grams);
}

/** An item's manual value override always wins; otherwise grams x today's rate for its karat, or null if there's no rate at all yet. */
export function effectiveGoldItemValuePaise(item: Pick<NwGoldItem, "karat" | "grams" | "manualValuePaise">, rate: NwGoldRate | null): number | null {
  if (item.manualValuePaise !== undefined) return item.manualValuePaise;
  if (!rate) return null;
  return goldItemValuePaise(item.karat, item.grams, rate);
}
