import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { trashFile } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { DocFile, DocRecord } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  files: z.array(z.object({
    driveFileId: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
  })).min(1).max(50),
});

/** POST { files } — attach extra files (already uploaded to Drive) to a document. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { files } = Body.parse(await req.json());
    const ref = db().collection("doc_records").doc(id);
    await db().runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Document not found");
      const record = snap.data() as DocRecord;
      const now = Date.now();
      const add: DocFile[] = files.map((f) => ({ ...f, addedBy: user.email, addedAt: now }));
      t.update(ref, { attachments: [...(record.attachments ?? []), ...add], updatedAt: now });
    });
    return ok({ added: files.length });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?file=<driveFileId> — removes one extra file (it goes to Drive's trash, recoverable for 30 days). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const fileId = new URL(req.url).searchParams.get("file");
    const ref = db().collection("doc_records").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Document not found");
    const record = snap.data() as DocRecord;
    if (!(record.attachments ?? []).some((a) => a.driveFileId === fileId)) return ok({ removed: false });
    await ref.update({ attachments: (record.attachments ?? []).filter((a) => a.driveFileId !== fileId), updatedAt: Date.now() });
    await trashFile(fileId!).catch(() => undefined);
    return ok({ removed: true });
  } catch (e) {
    return fail(e);
  }
}
