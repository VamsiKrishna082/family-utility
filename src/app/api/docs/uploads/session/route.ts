import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { breadcrumbs, createUploadSession, invalidate, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  folderId: z.string().nullable(),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    const parentId = body.folderId ?? docsRootId();

    await breadcrumbs(parentId, docsRootId());

    const uploadUrl = await createUploadSession({
      name: body.name,
      mimeType: body.mimeType,
      size: body.size,
      parentId,
    });

    invalidate(parentId);
    return ok({ uploadUrl });
  } catch (e) {
    return fail(e);
  }
}
