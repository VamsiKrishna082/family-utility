import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { breadcrumbs, createUploadSession, invalidate, rootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  folderId: z.string().nullable(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

/**
 * The only step an upload needs from the server. Afterwards the browser talks
 * to Google directly and then just refreshes the listing — there is nothing to record.
 */
export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    const parentId = body.folderId ?? rootId();

    await breadcrumbs(parentId);

    const uploadUrl = await createUploadSession({
      name: body.name,
      mimeType: body.mimeType,
      size: body.size,
      parentId,
    });

    invalidate(parentId); // the listing is about to change
    return ok({ uploadUrl });
  } catch (e) {
    return fail(e);
  }
}
