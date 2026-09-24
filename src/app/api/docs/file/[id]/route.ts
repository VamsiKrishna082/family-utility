import { requireUser } from "@/lib/auth";
import { proxyDriveFile } from "@/lib/drive";
import { fail } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Proxies a document out of Drive — same reasoning as /api/stream/[id]: a raw
 * Drive link would outlive the session, so we fetch it ourselves each time.
 * PDFs open inline (view in the browser tab); everything else downloads.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    return await proxyDriveFile(id, req.headers.get("range"));
  } catch (e) {
    return fail(e);
  }
}
