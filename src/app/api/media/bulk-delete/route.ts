import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { trashFile, invalidate } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(200),
  folder: z.string().nullable(),
});

/** One request for N deletes instead of N round trips from the browser — used by multi-select. */
export async function POST(req: Request) {
  try {
    await requireUser();
    const { ids, folder } = Body.parse(await req.json());

    const results = await Promise.allSettled(ids.map((id) => trashFile(id)));
    const failed = ids.filter((_, i) => results[i].status === "rejected");

    if (folder) invalidate(folder);

    return ok({ deleted: ids.length - failed.length, failed });
  } catch (e) {
    return fail(e);
  }
}
