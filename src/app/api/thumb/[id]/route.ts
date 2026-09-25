import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { serveThumb, thumbWidth } from "@/lib/thumbs";

export const runtime = "nodejs";

/** GET /api/thumb/:id?w=520|1600 — album thumbnails (WebP, cached in GCS). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    return await serveThumb(id, thumbWidth(Number(new URL(req.url).searchParams.get("w") ?? 520)));
  } catch (e) {
    return fail(e);
  }
}
