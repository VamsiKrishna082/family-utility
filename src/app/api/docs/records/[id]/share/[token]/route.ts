import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

/** Revokes a share link immediately — the public /share/[token] route checks this on every request, no caching. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string; token: string }> }) {
  try {
    await requireUser();
    const { token } = await ctx.params;
    await db().collection("doc_shares").doc(token).set({ revoked: true }, { merge: true });
    return ok({ token });
  } catch (e) {
    return fail(e);
  }
}
