import { proxyDriveFile } from "@/lib/drive";
import { folderShareByToken, sharedFolderContents } from "@/lib/docFolderShare";

export const runtime = "nodejs";

/**
 * GET /share/folder/<token>/file/<driveFileId> — one file from a shared
 * folder. Public, so it re-checks the link on every request and only serves
 * a file that belongs to a document inside the shared folder tree.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await ctx.params;
  const share = await folderShareByToken(token);
  if (!share) return new Response("Not found", { status: 404 });
  const { docs } = await sharedFolderContents(share);
  if (!docs.some((d) => d.files.some((f) => f.driveFileId === fileId))) return new Response("Not found", { status: 404 });
  return proxyDriveFile(fileId, req.headers.get("range"));
}
