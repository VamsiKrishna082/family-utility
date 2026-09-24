import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { docsRootId, findRecentUpload } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1) });

/** Fallback for the resumable-upload CORS quirk — see findRecentUpload's own doc comment in lib/drive.ts. */
export async function POST(req: Request) {
  try {
    await requireUser();
    const { name } = Body.parse(await req.json());
    const driveFileId = await findRecentUpload(name, docsRootId());
    return ok({ driveFileId });
  } catch (e) {
    return fail(e);
  }
}
