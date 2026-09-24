import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { DocRecord, DocShare } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const snap = await db().collection("doc_shares").where("recordId", "==", id).get();
    const items = snap.docs.map((d) => d.data() as DocShare).sort((a, b) => b.createdAt - a.createdAt);
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({ expiresInDays: z.number().int().min(1).max(90) });

/** The linked file is whatever version is current right now — replacing the document later doesn't change what an already-issued link shows. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { expiresInDays } = Body.parse(await req.json());

    const recSnap = await db().collection("doc_records").doc(id).get();
    if (!recSnap.exists) throw new Error("Document not found");
    const record = recSnap.data() as DocRecord;

    const token = randomUUID();
    const now = Date.now();
    const share: DocShare = {
      token,
      recordId: id,
      driveFileId: record.currentDriveFileId,
      createdBy: user.email,
      createdAt: now,
      expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
      revoked: false,
    };
    await db().collection("doc_shares").doc(token).set(share);
    return ok({ share });
  } catch (e) {
    return fail(e);
  }
}
