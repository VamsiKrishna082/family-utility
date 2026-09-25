import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { DOC_EXPIRY_LABELS, DOC_OWNERS, type DocRecord, type DocVersion } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/docs/records — every non-archived record. A household's document count is small enough that owner/category/tag/search filtering just happens client-side, same reasoning as Money's category list. */
export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("doc_records").where("archived", "==", false).get();
    const items = snap.docs.map((d) => d.data() as DocRecord).sort((a, b) => b.updatedAt - a.updatedAt);
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(140),
  categoryId: z.string().min(1),
  owner: z.enum(DOC_OWNERS),
  driveFileId: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryLabel: z.enum(DOC_EXPIRY_LABELS).optional(),
  issuer: z.string().trim().max(100).optional(),
  refNumberMasked: z.string().trim().max(60).optional(),
  coverAmountPaise: z.number().int().positive().optional(),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).default([]),
  folderId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = Body.parse(await req.json());

    const catSnap = await db().collection("doc_categories").doc(body.categoryId).get();
    if (!catSnap.exists) throw new Error("Unknown category");
    if (body.folderId && !(await db().collection("doc_folders").doc(body.folderId).get()).exists) throw new Error("That folder no longer exists");

    const ref = db().collection("doc_records").doc();
    const now = Date.now();
    const version: DocVersion = { driveFileId: body.driveFileId, mimeType: body.mimeType, sizeBytes: body.sizeBytes, addedBy: user.email, addedAt: now };
    const record: DocRecord = {
      id: ref.id,
      name: body.name,
      categoryId: body.categoryId,
      owner: body.owner,
      currentDriveFileId: body.driveFileId,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      expiryDate: body.expiryDate,
      expiryLabel: body.expiryLabel,
      issuer: body.issuer,
      refNumberMasked: body.refNumberMasked,
      coverAmountPaise: body.coverAmountPaise,
      notes: body.notes,
      tags: body.tags,
      ...(body.folderId ? { folderId: body.folderId } : {}),
      attachments: [],
      versions: [version],
      archived: false,
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(record);
    return ok({ record });
  } catch (e) {
    return fail(e);
  }
}
