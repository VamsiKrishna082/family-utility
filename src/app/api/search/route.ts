import { requireUser } from "@/lib/auth";
import { searchLibrary, rootId, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/search?q=<term>&scope=album|docs — name search across the whole library, not just the current folder. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const scope = url.searchParams.get("scope") === "docs" ? docsRootId() : rootId();

    if (q.length < 2) {
      const empty: SearchResponse = { query: q, results: [] };
      return ok(empty);
    }

    const results = await searchLibrary(q, scope);
    const body: SearchResponse = { query: q, results };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
