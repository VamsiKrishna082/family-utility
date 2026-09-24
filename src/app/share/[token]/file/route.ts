import { proxyDriveFile } from "@/lib/drive";
import { validateShareToken } from "@/lib/docShare";

export const runtime = "nodejs";

/**
 * Deliberately unauthenticated — this is the one route in the app reachable
 * without signing in. Every request re-validates the token (expiry, revoked)
 * rather than trusting that the page already checked it.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const valid = await validateShareToken(token);
  if (!valid) return new Response("Not found", { status: 404 });
  return proxyDriveFile(valid.share.driveFileId, req.headers.get("range"));
}
