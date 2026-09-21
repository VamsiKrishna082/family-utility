import { requireUser } from "@/lib/auth";
import { accessToken, mimeOf } from "@/lib/drive";
import { fail } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Streams a video out of Drive with range support so the player can seek.
 * Proxied rather than linked, because a raw Drive link would outlive the session.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const range = req.headers.get("range");

    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          ...(range ? { Range: range } : {}),
        },
      },
    );

    const headers = new Headers();
    headers.set("Content-Type", await mimeOf(id));
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=3600");
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return fail(e);
  }
}
