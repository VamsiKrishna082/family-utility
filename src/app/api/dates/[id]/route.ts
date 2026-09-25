import { FieldValue } from "@google-cloud/firestore";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { checkCalendar, DtEventBody } from "@/lib/dates/schema";
import type { DtEvent } from "@/lib/dates/types";

export const runtime = "nodejs";

const Patch = DtEventBody.partial();

/** PATCH — any subset of fields. Clearing an optional field (person, year, phone…) is done by sending null. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const raw = (await req.json()) as Record<string, unknown>;
    const cleared = Object.keys(raw).filter((k) => raw[k] === null && ["person", "relation", "side", "year", "phone"].includes(k));
    for (const k of cleared) delete raw[k];
    const patch = Patch.parse(raw);

    const ref = db().collection("dates").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    const merged = { ...(snap.data() as DtEvent), ...patch };
    for (const k of cleared) delete (merged as Record<string, unknown>)[k];
    const problem = checkCalendar(merged);
    if (problem) throw new Response(JSON.stringify({ error: problem }), { status: 400 });

    await ref.update({
      ...patch,
      ...Object.fromEntries(cleared.map((k) => [k, FieldValue.delete()])),
      updatedAt: Date.now(),
    });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    await db().collection("dates").doc(id).delete();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
