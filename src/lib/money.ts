const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * 4200 -> "₹4,200" (Indian digit grouping, no decimals). Takes whole rupees —
 * used by every section except Money (Worth, Vehicles, Wishlist, Bills, Trips
 * all store amounts as plain rupee numbers, not paise).
 */
export function formatINR(amountRupees: number): string {
  return rupeeFormatter.format(amountRupees);
}

/**
 * 11510000 paise -> "₹1,15,100". Both Money and Net worth store integer paise
 * (see money.md / networth.md), never floats. Anything ₹1,00,000 and over
 * switches to lakh ("₹38.6 L") and ₹1,00,00,000 and over to crore ("₹1.25
 * Cr") — a full-digit six-, seven- or eight-figure number is hard to read at
 * a glance in a dashboard card. Money's own figures will essentially never
 * reach crore; net worth totals (property, combined assets) realistically can.
 */
export function formatPaise(amountPaise: number): string {
  const sign = amountPaise < 0 ? "-" : "";
  const rupeeValue = Math.abs(amountPaise) / 100;
  if (rupeeValue >= 1_00_00_000) {
    const crores = rupeeValue / 1_00_00_000;
    return `${sign}₹${crores.toFixed(crores >= 10 ? 1 : 2)} Cr`;
  }
  if (rupeeValue >= 100_000) {
    const lakhs = rupeeValue / 100_000;
    return `${sign}₹${lakhs.toFixed(lakhs >= 10 ? 1 : 2)} L`;
  }
  return `${sign}${formatINR(rupeeValue)}`;
}

/** Full-precision paise formatting, for places the lakh abbreviation would lose needed detail (e.g. an exact budget remainder). */
export function formatPaiseExact(amountPaise: number): string {
  return formatINR(amountPaise / 100);
}

/** A user-typed rupee string, e.g. "1250.50" -> 125050 paise. Returns null if not a valid positive amount. */
export function parseRupeesToPaise(input: string): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * Trims a typed sub-category and snaps it to an existing one's spelling when
 * they match case-insensitively, so "elanir" and "Elanir " total together in
 * the category drill-down instead of showing as two rows. Empty -> undefined.
 */
export function normalizeSubcategory(input: string | null | undefined, existing: string[] = []): string | undefined {
  const trimmed = (input ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return existing.find((s) => s.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}
