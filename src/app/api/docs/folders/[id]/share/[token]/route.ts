import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

/** PATCH — revoke a folder link; it stops working immediately. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string; token: string }> }) {
  try {
    await requireUser();
    const { id, token } = await ctx.params;
    const ref = db().collection("doc_folder_shares").doc(token);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.folderId !== id) throw new Error("Link not found");
    await ref.update({ revoked: true });
    return ok({ revoked: true });
  } catch (e) {
    return fail(e);
  }
}
