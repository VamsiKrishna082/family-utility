import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { MONEY_SEED_CATEGORIES, MONEY_TX_TYPES, type MoneyCategory } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/money/categories — seeds the default set on first call if the collection is empty, then lists everything ordered by group. */
export async function GET() {
  try {
    await requireUser();
    const col = db().collection("money_categories");
    const snap = await col.get();

    if (snap.empty) {
      const batch = db().batch();
      const seeded: MoneyCategory[] = MONEY_SEED_CATEGORIES.map((c, i) => {
        const ref = col.doc();
        const doc: MoneyCategory = { id: ref.id, name: c.name, group: c.group, type: c.type, order: i, archived: false, useCount: 0 };
        batch.set(ref, doc);
        return doc;
      });
      await batch.commit();
      seeded.sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);
      return ok({ items: seeded });
    }

    const items = snap.docs
      .map((d) => d.data() as MoneyCategory)
      .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order);
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  group: z.string().trim().min(1).max(80),
  type: z.enum(MONEY_TX_TYPES),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { name, group, type } = Body.parse(await req.json());
    const col = db().collection("money_categories");
    const siblings = await col.where("group", "==", group).get();
    const ref = col.doc();
    const doc: MoneyCategory = { id: ref.id, name, group, type, order: siblings.size, archived: false, useCount: 0 };
    await ref.set(doc);
    return ok({ category: doc });
  } catch (e) {
    return fail(e);
  }
}
