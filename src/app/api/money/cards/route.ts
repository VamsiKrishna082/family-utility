import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { MoneyCard, MoneyCategory } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("money_cards").orderBy("order", "asc").get();
    return ok({ items: snap.docs.map((d) => d.data() as MoneyCard) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  last4: z.string().trim().regex(/^\d{4}$/).optional(),
});

/** Also ensures a "Credit Card" expense category exists, so the bill-payment flow always has somewhere to file into without the user having to remember to create it first. */
async function ensureCreditCardCategory(): Promise<void> {
  const existing = await db().collection("money_categories").where("type", "==", "expense").where("name", "==", "Credit Card").limit(1).get();
  if (!existing.empty) return;
  const countSnap = await db().collection("money_categories").where("type", "==", "expense").get();
  const ref = db().collection("money_categories").doc();
  const category: MoneyCategory = {
    id: ref.id, name: "Credit Card", group: "Miscellaneous", type: "expense",
    order: countSnap.size, archived: false, useCount: 0,
  };
  await ref.set(category);
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    const [existing] = await Promise.all([
      db().collection("money_cards").get(),
      ensureCreditCardCategory(),
    ]);
    const ref = db().collection("money_cards").doc();
    const now = Date.now();
    const card: MoneyCard = { id: ref.id, name: body.name, last4: body.last4, archived: false, order: existing.size, createdAt: now, updatedAt: now };
    await ref.set(card);
    return ok({ card });
  } catch (e) {
    return fail(e);
  }
}
