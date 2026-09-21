import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1).max(60), regNumber: z.string().max(20).default("") });

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("vehicles").orderBy("createdAt", "asc").get();
    return ok({ items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    const ref = await db().collection("vehicles").add({ ...body, logs: [], createdAt: Date.now() });
    return ok({ id: ref.id });
  } catch (e) {
    return fail(e);
  }
}
