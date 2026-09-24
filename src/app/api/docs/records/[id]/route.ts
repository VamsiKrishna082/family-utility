import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { trashFile } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import { DOC_EXPIRY_LABELS, DOC_OWNERS, type DocRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const snap = await db().collection("doc_records").doc(id).get();
    if (!snap.exists) throw new Error("Document not found");
    return ok({ record: snap.data() as DocRecord });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(140).optional(),
  categoryId: z.string().min(1).optional(),
  owner: z.enum(DOC_OWNERS).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiryLabel: z.enum(DOC_EXPIRY_LABELS).nullable().optional(),
  issuer: z.string().trim().max(100).nullable().optional(),
  refNumberMasked: z.string().trim().max(60).nullable().optional(),
  coverAmountPaise: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    // undefined fields are stripped on write (ignoreUndefinedProperties) and
    // left untouched by the merge; an explicit null clears that field.
    await db().collection("doc_records").doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/** Archives the record and trashes every version's underlying Drive file — a document isn't legally meaningful half-deleted. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const ref = db().collection("doc_records").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return ok({ id });
    const record = snap.data() as DocRecord;

    await Promise.all(record.versions.map((v) => trashFile(v.driveFileId).catch(() => undefined)));
    await ref.set({ archived: true, updatedAt: Date.now() }, { merge: true });
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
