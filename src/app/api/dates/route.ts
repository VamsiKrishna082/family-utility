import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { checkCalendar, DtEventBody } from "@/lib/dates/schema";
import type { DtEvent } from "@/lib/dates/types";

export const runtime = "nodejs";

/** GET /api/dates — every date; the page sorts by next occurrence itself (that depends on "today"). */
export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("dates").get();
    return ok({ items: snap.docs.map((d) => ({ ...(d.data() as DtEvent), id: d.id })) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = DtEventBody.parse(await req.json());
    const problem = checkCalendar(body);
    if (problem) throw new Response(JSON.stringify({ error: problem }), { status: 400 });
    const ref = db().collection("dates").doc();
    const now = Date.now();
    const ev: DtEvent = { ...body, id: ref.id, createdBy: user.email, createdAt: now, updatedAt: now };
    await ref.set(ev);
    return ok({ event: ev });
  } catch (e) {
    return fail(e);
  }
}
