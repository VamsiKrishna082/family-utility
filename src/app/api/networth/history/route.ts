import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { NwSnapshot } from "@/lib/types";

export const runtime = "nodejs";

/** GET — every month's net worth (one small doc per month), oldest first, for the trend chart. */
export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("nw_snapshots").get();
    const points = snap.docs
      .map((d) => d.data() as NwSnapshot)
      .map((s) => ({ monthKey: s.monthKey, netPaise: s.totals.netPaise, assetsPaise: s.totals.assetsPaise, liabilitiesPaise: s.totals.liabilitiesPaise }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return ok({ points });
  } catch (e) {
    return fail(e);
  }
}
