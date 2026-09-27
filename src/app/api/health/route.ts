import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { HealthItem, HealthProfile } from "@/lib/health";
import { healthPeople } from "@/lib/healthPeople";
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
    const people = await healthPeople();
    const person = people.find((p) => p.id === id) ?? people[0];

    const [profileSnap, itemsSnap, catSnap, docsSnap] = await Promise.all([
      db().collection("health_profiles").doc(person.id).get(),
      db().collection("health_items").where("person", "==", person.id).get(),
      db().collection("doc_categories").get(),
      db().collection("doc_records").where("owner", "==", person.docOwner).get(),
    ]);
    const medical = new Set(catSnap.docs.map((d) => d.data() as DocCategory).filter((c) => /medic|health/i.test(c.name)).map((c) => c.id));
    let medicalDocs = docsSnap.docs
      .map((d) => d.data() as DocRecord)
      .filter((r) => !r.archived && (medical.has(r.categoryId) || r.tags?.some((t) => /medic|health|prescription|report|insurance/i.test(t))));
    // Family members share the "Parents" owner in Documents: show the ones that mention this person,
    // or — if none mention anyone's name yet — all of the parents' medical documents.
    if (person.custom) {
      const says = (r: DocRecord, name: string) => `${r.name} ${(r.tags ?? []).join(" ")} ${r.notes ?? ""}`.toLowerCase().includes(name.toLowerCase());
      const mine = medicalDocs.filter((r) => says(r, person.name));
      const anyNamed = medicalDocs.some((r) => people.some((p) => p.custom && says(r, p.name)));
      medicalDocs = mine.length || anyNamed ? mine : medicalDocs;
    }
    const docs = medicalDocs
      .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, expiryDate: r.expiryDate ?? null }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const profile: HealthProfile = profileSnap.exists
      ? (() => { const d = profileSnap.data() as HealthProfile; return { ...d, allergies: d.allergies ?? [], conditions: d.conditions ?? [] }; })()
      : { person: person.id, allergies: [], conditions: [], updatedAt: 0 };
    const items = itemsSnap.docs.map((d) => d.data() as HealthItem).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.createdAt - a.createdAt);
    return ok({ person, people, profile, items, docs });
  } catch (e) {
    return fail(e);
  }
}
