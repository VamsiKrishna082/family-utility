import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { trashFile, renameFile, setStarred, setFolderCover, moveFile, invalidate } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

/**
 * DELETE /api/media/<id>?folder=<parentId>
 * Trashes the file in Drive (see trashFile — recoverable, not a hard delete)
 * and drops that folder's cached listing so the grid reflects it immediately
 * rather than waiting out the 60s TTL.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const folderId = new URL(req.url).searchParams.get("folder");

    await trashFile(id);
    if (folderId) invalidate(folderId);

    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

const PatchBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  starred: z.boolean().optional(),
  /** Sets (or, with null, clears) `id`'s own cover photo — `id` here is a folder. */
  cover: z.string().nullable().optional(),
  /** Destination folder id — moves `id` there out of the `?folder=` (source) param. */
  moveTo: z.string().optional(),
});

/**
 * PATCH /api/media/<id>?folder=<parentId> — rename, favourite, set-cover and/or
 * move, in one route. Rename works for a photo/video or a folder, Drive treats
 * renames identically. Favouriting is Drive's own `starred` flag, not a move —
 * the file never leaves its folder. `cover` targets `id` as a folder, setting
 * which child represents it. `moveTo` re-parents `id` from `?folder=` to a new folder.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const folderId = new URL(req.url).searchParams.get("folder");
    const { name, starred, cover, moveTo } = PatchBody.parse(await req.json());

    if (name) await renameFile(id, name);
    if (starred !== undefined) await setStarred(id, starred);
    if (cover !== undefined) await setFolderCover(id, cover);
    if (moveTo) {
      if (!folderId) throw new Error("Moving needs the source folder (?folder=)");
      await moveFile(id, folderId, moveTo);
      invalidate(moveTo);
    }
    if (folderId) invalidate(folderId);

    return ok({ id, name, starred, cover, moveTo });
  } catch (e) {
    return fail(e);
  }
}
