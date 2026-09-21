import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { thumbnail as driveThumb } from "@/lib/drive";
import { gcsExists, gcsUpload, gcsDownload } from "@/lib/gcs";
import { fail } from "@/lib/http";

export const runtime = "nodejs";

const SIZES = [520, 1600];
const QUALITY: Record<number, number> = { 520: 72, 1600: 82 };

// Keys confirmed to exist in GCS. Survives for the lifetime of the Cloud Run instance,
// so a warm server never does an exists() check — it goes straight to download().
const knownKeys = new Set<string>();

function key(id: string, width: number) {
  return `thumb/${id}_w${width}.webp`;
}

/**
 * First request: fetches Drive's thumbnail, resizes to a WebP with sharp, stores in GCS.
 * Every request after that reads from GCS (~20 ms) instead of hitting Drive again.
 * The browser caches the result forever (immutable header), so most loads never reach here.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const asked = Number(new URL(req.url).searchParams.get("w") ?? 520);
    const width = SIZES.includes(asked) ? asked : 520;
    const gcsKey = key(id, width);

    // --- serve from GCS if already generated ---
    // knownKeys skips the exists() round trip for files this instance has already seen.
    if (knownKeys.has(gcsKey) || await gcsExists(gcsKey)) {
      knownKeys.add(gcsKey);
      const bytes = await gcsDownload(gcsKey);
      return respond(bytes);
    }

    // --- not yet in GCS: fetch from Drive, resize, store ---
    // Ask Drive for a 1600px source so we have quality headroom for both sizes.
    const source = await driveThumb(id, 1600);
    if (!source) {
      // Drive hasn't generated a thumbnail yet (fresh upload). Tell the client to retry.
      return new Response(null, {
        status: 202,
        headers: { "Retry-After": "3", "Cache-Control": "no-store" },
      });
    }

    const webp = await sharp(Buffer.from(source.body))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY[width] ?? 72 })
      .toBuffer();

    // Store async — do not await so we respond to the browser immediately.
    gcsUpload(gcsKey, webp, "image/webp").then(() => knownKeys.add(gcsKey)).catch(() => {});

    return respond(webp);
  } catch (e) {
    return fail(e);
  }
}

function respond(bytes: Buffer) {
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
