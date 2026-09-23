import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { MoneyGoal } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("money_goals").orderBy("createdAt", "asc").get();
    return ok({ items: snap.docs.map((d) => d.data() as MoneyGoal) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  targetPaise: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { name, targetPaise } = Body.parse(await req.json());
    const ref = db().collection("money_goals").doc();
    const now = Date.now();
    const goal: MoneyGoal = { id: ref.id, name, targetPaise, savedPaise: 0, createdAt: now, updatedAt: now };
    await ref.set(goal);
    return ok({ goal });
  } catch (e) {
    return fail(e);
  }
}
