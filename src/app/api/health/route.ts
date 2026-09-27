import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { HEALTH_PEOPLE, type HealthItem, type HealthProfile } from "@/lib/health";
import type { DocCategory, DocRecord } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/health?p=vamsi|varshini|parents — one person's health page: the
 * profile (blood group, allergies, conditions), every visit/medicine/test/
 * vaccine, and their Medical documents from Documents (same owner).
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const id = new URL(req.url).searchParams.get("p") ?? "vamsi";
    const person = HEALTH_PEOPLE.find((p) => p.id === id);
    if (!person) throw new Error("Unknown person");

    const [profileSnap, itemsSnap, catSnap, docsSnap] = await Promise.all([
      db().collection("health_profiles").doc(person.id).get(),
      db().collection("health_items").where("person", "==", person.id).get(),
      db().collection("doc_categories").get(),
      db().collection("doc_records").where("owner", "==", person.docOwner).get(),
    ]);
    const medical = new Set(catSnap.docs.map((d) => d.data() as DocCategory).filter((c) => /medic|health/i.test(c.name)).map((c) => c.id));
    const docs = docsSnap.docs
      .map((d) => d.data() as DocRecord)
      .filter((r) => !r.archived && (medical.has(r.categoryId) || r.tags?.some((t) => /medic|health|prescription|report|insurance/i.test(t))))
      .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, expiryDate: r.expiryDate ?? null }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const profile: HealthProfile = profileSnap.exists
      ? (() => { const d = profileSnap.data() as HealthProfile; return { ...d, allergies: d.allergies ?? [], conditions: d.conditions ?? [] }; })()
      : { person: person.id, allergies: [], conditions: [], updatedAt: 0 };
    const items = itemsSnap.docs.map((d) => d.data() as HealthItem).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.createdAt - a.createdAt);
    return ok({ person, profile, items, docs });
  } catch (e) {
    return fail(e);
  }
}
