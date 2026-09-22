import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { moveFile, invalidate } from "@/lib/drive";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(200),
  from: z.string(),
  to: z.string(),
});

/** One request for N moves instead of N round trips — used by multi-select. */
export async function POST(req: Request) {
  try {
    await requireUser();
    const { ids, from, to } = Body.parse(await req.json());

    const results = await Promise.allSettled(ids.map((id) => moveFile(id, from, to)));
    const failed = ids.filter((_, i) => results[i].status === "rejected");

    invalidate(from);
    invalidate(to);

    return ok({ moved: ids.length - failed.length, failed });
  } catch (e) {
    return fail(e);
  }
}
