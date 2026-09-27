import { requireUser } from "@/lib/auth";
import { fileMeta, sendDriveBytes } from "@/lib/drive";
import { fail } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Streams a video out of Drive with range support so the player can seek.
 * Proxied rather than linked, because a raw Drive link would outlive the session.
 * Sent in slices of at most 8 MB (see src/lib/range.ts) — Cloud Run refuses
 * responses over 32 MiB, which broke every longer video in production.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const meta = await fileMeta(id);
    // iPhone .MOV files are MP4-family; Chrome won't try a "video/quicktime" response but plays it as video/mp4.
    const mimeType = meta.mimeType === "video/quicktime" ? "video/mp4" : meta.mimeType;
    return await sendDriveBytes(id, { ...meta, mimeType }, req.headers.get("range"), {}, { sliceWithoutRange: true });
  } catch (e) {
    return fail(e);
  }
}
