import { requireUser } from "@/lib/auth";
import { listFavorites, rootId, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { FavoritesResponse } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/favorites?scope=album|docs — every starred item in the library, regardless of which folder it's in. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const scope = new URL(req.url).searchParams.get("scope") === "docs" ? docsRootId() : rootId();

    const results = await listFavorites(scope);
    const body: FavoritesResponse = { results };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
