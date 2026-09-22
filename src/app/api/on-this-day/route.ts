import { requireUser } from "@/lib/auth";
import { onThisDay, rootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { FavoritesResponse } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/on-this-day — photos taken today's month/day in a past year. */
export async function GET() {
  try {
    await requireUser();
    const results = await onThisDay(rootId());
    const body: FavoritesResponse = { results };
    return ok(body);
  } catch (e) {
    return fail(e);
  }
}
