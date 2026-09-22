import { requireUser } from "@/lib/auth";
import { listFolder, breadcrumbs, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { BrowseResponse } from "@/lib/types";

export const runtime = "nodejs";

/** Same shape as /api/browse, pointed at the Documents root instead of Album's. */
export async function GET(req: Request) {
  try {
    await requireUser();

    const url = new URL(req.url);
    const asked = url.searchParams.get("folder");
    const folderId = asked && asked !== "root" ? asked : docsRootId();
    const skipCache = url.searchParams.get("refresh") === "1";

    const [crumbs, entries] = await Promise.all([breadcrumbs(folderId, docsRootId()), listFolder(folderId, skipCache)]);

    const body: BrowseResponse = { folderId, crumbs, entries };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
