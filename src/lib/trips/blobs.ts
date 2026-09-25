import { HttpError } from "@/lib/trips/store";

/** Shared checks for small files uploaded straight to the API (voice notes, receipt photos), stored in GCS. */
export async function readUpload(req: Request, allowed: RegExp, maxBytes: number): Promise<{ buf: Buffer; contentType: string }> {
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!allowed.test(contentType)) throw new HttpError(`Unsupported file type: ${contentType || "unknown"}`, 415);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw new HttpError("Empty file");
  if (buf.length > maxBytes) throw new HttpError(`File too large (max ${Math.round(maxBytes / 1_000_000)} MB)`, 413);
  return { buf, contentType };
}

export function serveBlob(buf: Buffer, contentType: string, filename?: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
      ...(filename ? { "Content-Disposition": `inline; filename="${filename.replace(/[^\w.-]/g, "_")}"` } : {}),
    },
  });
}
