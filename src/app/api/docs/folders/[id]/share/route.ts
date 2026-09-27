import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { DocFolder, DocFolderShare } from "@/lib/types";

export const runtime = "nodejs";

/** GET — this folder's share links (newest first). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const snap = await db().collection("doc_folder_shares").where("folderId", "==", id).get();
    return ok({ items: snap.docs.map((d) => d.data() as DocFolderShare).sort((a, b) => b.createdAt - a.createdAt) });
  } catch (e) {
    return fail(e);
  }
}

/** POST { days: 1 | 7 | 30 } — a new read-only link to the folder and everything under it, expiring after that long. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { days } = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30)]) }).parse(await req.json());
    const folder = await db().collection("doc_folders").doc(id).get();
    if (!folder.exists) throw new Error("Folder not found");
    const token = randomBytes(24).toString("base64url");
    const now = Date.now();
    const share: DocFolderShare = {
      token, folderId: id, folderName: (folder.data() as DocFolder).name,
      createdBy: user.email, createdAt: now, expiresAt: now + days * 86_400_000, revoked: false,
    };
    await db().collection("doc_folder_shares").doc(token).set(share);
    return ok({ share });
  } catch (e) {
    return fail(e);
  }
}
