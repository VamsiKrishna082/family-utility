import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1).max(60) });

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("lists").orderBy("createdAt", "asc").get();
    return ok({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const { name } = Body.parse(await req.json());
    const now = Date.now();
    const ref = await db().collection("lists").add({ name, items: [], createdAt: now, updatedAt: now });
    return ok({ id: ref.id });
  } catch (e) {
    return fail(e);
  }
}
