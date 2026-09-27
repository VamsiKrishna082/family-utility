/**
 * Pure text matching for app-wide search — tested in scripts/find.test.mjs.
 * Every word typed must appear somewhere (in any order, any case, ignoring
 * accents), so "pan card" finds "Card – PAN (Vamsi)".
 */
export function norm(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function terms(q: string): string[] {
  return norm(q).split(/[\s,]+/).filter((t) => t.length > 0).slice(0, 8);
}

export function matchesAll(haystack: string, words: string[]): boolean {
  if (!words.length) return false;
  const h = norm(haystack);
  return words.every((w) => h.includes(w));
}

/** A short excerpt around the first hit, e.g. for a trip day's story: "…we finally reached the fort at sunset…". */
export function snippet(text: string, words: string[], radius = 50): string {
  const n = norm(text);
  let at = -1;
  for (const w of words) {
    const i = n.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

/** Drive query literal: the text inside '...' with quotes and backslashes escaped. */
export function driveLiteral(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
