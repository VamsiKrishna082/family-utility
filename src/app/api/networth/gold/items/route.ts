import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { NwGoldItem } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("nw_gold_items").orderBy("createdAt", "asc").get();
    return ok({ items: snap.docs.map((d) => d.data() as NwGoldItem) });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  accountId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  karat: z.union([z.literal(24), z.literal(22), z.literal(18)]),
  grams: z.number().positive(),
  buyPricePaise: z.number().int().positive().optional(),
  buyDate: z.string().min(1),
  manualValuePaise: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    const ref = db().collection("nw_gold_items").doc();
    const now = Date.now();
    const item: NwGoldItem = { id: ref.id, ...body, createdAt: now, updatedAt: now };
    await ref.set(item);
    return ok({ item });
  } catch (e) {
    return fail(e);
  }
}
