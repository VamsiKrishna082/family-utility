import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { DocRecord, DocVersion } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  driveFileId: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  label: z.string().trim().max(60).optional(),
});

/** Adds a new current version — old ones stay in the versions list (and in Drive) for history, never deleted here. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());

    const ref = db().collection("doc_records").doc(id);
    await db().runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Document not found");
      const record = snap.data() as DocRecord;

      const version: DocVersion = { driveFileId: body.driveFileId, mimeType: body.mimeType, sizeBytes: body.sizeBytes, label: body.label, addedBy: user.email, addedAt: Date.now() };
      const versions = [version, ...record.versions];
      t.set(ref, { versions, currentDriveFileId: body.driveFileId, mimeType: body.mimeType, sizeBytes: body.sizeBytes, updatedAt: Date.now() }, { merge: true });
    });

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
