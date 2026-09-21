import { requireUser } from "@/lib/auth";
import { accessToken, fileMeta } from "@/lib/drive";
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
    const range = req.headers.get("range");

    const [meta, token] = await Promise.all([fileMeta(id), accessToken()]);

    const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
    });

    const headers = new Headers();
    headers.set("Content-Type", meta.mimeType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600");
    const disposition = meta.mimeType === "application/pdf" ? "inline" : "attachment";
    headers.set("Content-Disposition", `${disposition}; filename="${meta.name.replace(/"/g, "")}"`);
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return fail(e);
  }
}
