import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { trashFile, renameFile, setStarred, invalidate } from "@/lib/drive";
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
});

/**
 * PATCH /api/media/<id>?folder=<parentId> — rename and/or favourite in one route.
 * Rename works for a photo/video or a folder, Drive treats renames identically.
 * Favouriting is Drive's own `starred` flag, not a move — the file never leaves its folder.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const folderId = new URL(req.url).searchParams.get("folder");
    const { name, starred } = PatchBody.parse(await req.json());

    if (name) await renameFile(id, name);
    if (starred !== undefined) await setStarred(id, starred);
    if (folderId) invalidate(folderId);

    return ok({ id, name, starred });
  } catch (e) {
    return fail(e);
  }
}
