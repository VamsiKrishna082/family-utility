import { db } from "@/lib/firestore";
import type { DocRecord, DocShare } from "@/lib/types";

/**
 * The one place that decides whether a share token is still good — used by
 * both the public viewer page and the public file route, so a bug here can't
 * be fixed in one and missed in the other. Expired, revoked and unknown
 * tokens are all treated identically (null) — no signal to distinguish them,
 * so a guess can't be refined by trying again.
 */
export async function validateShareToken(token: string): Promise<{ share: DocShare; record: DocRecord } | null> {
  const shareSnap = await db().collection("doc_shares").doc(token).get();
  if (!shareSnap.exists) return null;
  const share = shareSnap.data() as DocShare;
  if (share.revoked) return null;
  if (share.expiresAt <= Date.now()) return null;

  const recordSnap = await db().collection("doc_records").doc(share.recordId).get();
  if (!recordSnap.exists) return null;
  return { share, record: recordSnap.data() as DocRecord };
}
