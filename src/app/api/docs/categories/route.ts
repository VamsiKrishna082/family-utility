import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { DOC_SEED_CATEGORIES, type DocCategory } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/docs/categories — seeds the default set on first call if the collection is empty, then lists everything ordered. */
export async function GET() {
  try {
    await requireUser();
    const col = db().collection("doc_categories");
    const snap = await col.get();

    if (snap.empty) {
      const batch = db().batch();
      const now = Date.now();
      const seeded: DocCategory[] = DOC_SEED_CATEGORIES.map((name, i) => {
        const ref = col.doc();
        const doc: DocCategory = { id: ref.id, name, order: i, archived: false, createdAt: now };
        batch.set(ref, doc);
        return doc;
      });
      await batch.commit();
      return ok({ items: seeded });
    }

    const items = snap.docs.map((d) => d.data() as DocCategory).sort((a, b) => a.order - b.order);
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(req: Request) {
  try {
    await requireUser();
    const { name } = Body.parse(await req.json());
    const col = db().collection("doc_categories");
    const existing = await col.get();
    const ref = col.doc();
    const category: DocCategory = { id: ref.id, name, order: existing.size, archived: false, createdAt: Date.now() };
    await ref.set(category);
    return ok({ category });
  } catch (e) {
    return fail(e);
  }
}
