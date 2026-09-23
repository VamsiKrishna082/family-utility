import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { MONEY_TX_TYPES, type MoneyRecurring } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/money/recurring — every active-first template, newest last within that. */
export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("money_recurring").get();
    const items = snap.docs
      .map((d) => d.data() as MoneyRecurring)
      .sort((a, b) => (a.active === b.active ? a.createdAt - b.createdAt : a.active ? -1 : 1));
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(MONEY_TX_TYPES),
  amountPaise: z.number().int().positive(),
  categoryId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await req.json());
    const ref = db().collection("money_recurring").doc();
    const now = Date.now();
    const template: MoneyRecurring = { id: ref.id, ...body, active: true, createdBy: user.email, createdAt: now, updatedAt: now };
    await ref.set(template);
    return ok({ template });
  } catch (e) {
    return fail(e);
  }
}
