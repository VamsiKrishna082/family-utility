import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { DocFolder } from "@/lib/types";

export const runtime = "nodejs";

/** GET — every folder (a household has few; the page builds the tree). */
export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("doc_folders").get();
    const items = snap.docs.map((d) => d.data() as DocFolder).sort((a, b) => a.name.localeCompare(b.name));
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().min(1).nullable() });

/** POST { name, parentId } — a folder at the top level (parentId null) or inside another. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { name, parentId } = Body.parse(await req.json());
    if (parentId && !(await db().collection("doc_folders").doc(parentId).get()).exists) throw new Error("Parent folder not found");
    const ref = db().collection("doc_folders").doc();
    const folder: DocFolder = { id: ref.id, name, parentId, createdBy: user.email, createdAt: Date.now() };
    await ref.set(folder);
    return ok({ folder });
  } catch (e) {
    return fail(e);
  }
}
