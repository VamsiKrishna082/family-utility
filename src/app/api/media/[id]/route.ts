import { requireUser } from "@/lib/auth";
import { trashFile, invalidate } from "@/lib/drive";
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
