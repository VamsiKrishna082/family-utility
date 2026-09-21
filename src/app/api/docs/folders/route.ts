import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { breadcrumbs, createFolder, docsRootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().nullable(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { name, parentId } = Body.parse(await req.json());
    const parent = parentId ?? docsRootId();

    await breadcrumbs(parent, docsRootId());
    const folder = await createFolder(name, parent);

    return ok({ folder });
  } catch (e) {
    return fail(e);
  }
}
