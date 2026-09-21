import { requireUser } from "@/lib/auth";
import { listFolder, breadcrumbs, rootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { BrowseResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/browse?folder=<id>
 * One request returns the breadcrumbs, the subfolders and the media.
 * The old version needed two round trips and a database; this needs neither.
 */
export async function GET(req: Request) {
  try {
    await requireUser();

    const asked = new URL(req.url).searchParams.get("folder");
    const folderId = asked && asked !== "root" ? asked : rootId();

    // breadcrumbs() also proves the folder sits inside the library, so it must run first.
    const [crumbs, entries] = await Promise.all([breadcrumbs(folderId), listFolder(folderId)]);

    const body: BrowseResponse = { folderId, crumbs, entries };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
