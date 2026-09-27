/**
 * Cloud Run refuses any response larger than 32 MiB ("Response size was too
 * large"), and a video player's first request is an open-ended
 * `Range: bytes=0-` — i.e. the whole file. So ranges are capped: the player
 * gets a 206 with the first slice and asks for the next one as it plays,
 * exactly as it does for seeking. Tested in scripts/range.test.mjs.
 */
export const MAX_SLICE = 8 * 1024 * 1024;

export type Slice = { start: number; end: number; partial: boolean };

/**
 * The byte slice to send for a request's Range header, or null when the range
 * can't be satisfied (→ 416). `partial` is false only when the whole file
 * fits in one slice and no range was asked for (→ a plain 200).
 */
export function sliceFor(range: string | null, size: number, max = MAX_SLICE): Slice | null {
  if (size <= 0) return range ? null : { start: 0, end: -1, partial: false };
  const cap = (start: number, end: number): Slice => ({ start, end: Math.min(end, start + max - 1, size - 1), partial: true });

  if (!range) return size <= max ? { start: 0, end: size - 1, partial: false } : cap(0, size - 1);

  // Only a single range is supported; players never ask for more.
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim().split(",")[0].trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    // suffix: the last N bytes
    const n = Number(m[2]);
    if (n <= 0) return null;
    return cap(Math.max(0, size - n), size - 1);
  }
  const start = Number(m[1]);
  if (start >= size) return null;
  const end = m[2] === "" ? size - 1 : Number(m[2]);
  if (end < start) return null;
  return cap(start, end);
}

/** Headers for a slice of a file of `size` bytes. */
export function sliceHeaders(s: Slice, size: number): Record<string, string> {
  const h: Record<string, string> = { "Accept-Ranges": "bytes", "Content-Length": String(Math.max(0, s.end - s.start + 1)) };
  if (s.partial) h["Content-Range"] = `bytes ${s.start}-${s.end}/${size}`;
  return h;
}
