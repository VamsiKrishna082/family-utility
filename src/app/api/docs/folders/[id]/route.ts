import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { DocFolder } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().trim().min(1).max(80).optional(), parentId: z.string().min(1).nullable().optional() });

/** PATCH — rename, or move under another folder (never into itself or one of its own sub-folders). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    if (patch.parentId !== undefined && patch.parentId !== null) {
      const all = new Map((await db().collection("doc_folders").get()).docs.map((d) => [d.id, d.data() as DocFolder]));
      if (!all.has(patch.parentId)) throw new Error("Target folder not found");
      // walk up from the target: reaching this folder means it would be moved inside itself
      for (let cur: string | null = patch.parentId; cur; cur = all.get(cur)?.parentId ?? null) {
        if (cur === id) throw new Error("A folder can't go inside itself");
      }
    }
    await db().collection("doc_folders").doc(id).update(patch);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * DELETE — removes the folder only. Its documents and sub-folders move up
 * to the folder it was in (or the top level), so nothing inside is lost.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const ref = db().collection("doc_folders").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return ok({ id });
    const parentId = (snap.data() as DocFolder).parentId;
    const [docs, subs] = await Promise.all([
      db().collection("doc_records").where("folderId", "==", id).get(),
      db().collection("doc_folders").where("parentId", "==", id).get(),
    ]);
    const batch = db().batch();
    docs.docs.forEach((d) => batch.update(d.ref, { folderId: parentId ?? FieldValue.delete(), updatedAt: Date.now() }));
    subs.docs.forEach((d) => batch.update(d.ref, { parentId }));
    batch.delete(ref);
    await batch.commit();
    return ok({ id, moved: docs.size, foldersMoved: subs.size });
  } catch (e) {
    return fail(e);
  }
}
