import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { docProblem, todayIST } from "@/lib/trips/logic";
import { getTrip } from "@/lib/trips/store";
import type { DocCheckItem } from "@/lib/trips/types";
import type { DocCategory, DocRecord } from "@/lib/types";

export const runtime = "nodejs";

const TRAVEL_DOC = /passport|visa|licen[cs]e|driving|aadhaar|voter|pan card|\bid\b|identity/i;

/**
 * GET — travel documents from the Documents section (passport, visa,
 * licence, ID) that are expired, expire during the trip, or have under 6
 * months left when it ends. Documents without an expiry date are skipped.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.endDate) return ok({ items: [], checked: 0 });
    const [recSnap, catSnap] = await Promise.all([
      db().collection("doc_records").where("archived", "==", false).get(),
      db().collection("doc_categories").get(),
    ]);
    const cats = new Map(catSnap.docs.map((d) => [d.id, (d.data() as DocCategory).name]));
    const travelDocs = recSnap.docs
      .map((d) => d.data() as DocRecord)
      .filter((r) => r.expiryDate && (TRAVEL_DOC.test(r.name) || /identity/i.test(cats.get(r.categoryId) ?? "")));
    const today = todayIST();
    const items: DocCheckItem[] = travelDocs
      .map((r) => ({ r, problem: docProblem(r.expiryDate!, trip.endDate!, today) }))
      .filter((x): x is { r: DocRecord; problem: DocCheckItem["problem"] } => x.problem !== null)
      .map(({ r, problem }) => ({ name: r.name, owner: r.owner, expiryDate: r.expiryDate!, problem }));
    return ok({ items, checked: travelDocs.length });
  } catch (e) {
    return fail(e);
  }
}
