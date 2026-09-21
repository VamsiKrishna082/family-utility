import { requireUser } from "@/lib/auth";
import { listFolder, breadcrumbs, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { BrowseResponse } from "@/lib/types";

export const runtime = "nodejs";

/** Same shape as /api/browse, pointed at the Documents root instead of Album's. */
export async function GET(req: Request) {
  try {
    await requireUser();

    const asked = new URL(req.url).searchParams.get("folder");
    const folderId = asked && asked !== "root" ? asked : docsRootId();

    const [crumbs, entries] = await Promise.all([breadcrumbs(folderId, docsRootId()), listFolder(folderId)]);

    const body: BrowseResponse = { folderId, crumbs, entries };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
