import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { breadcrumbs, rootId } from "@/lib/drive";
import { daysCol, getTrip, HttpError } from "@/lib/trips/store";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().max(120).optional(),
  story: z.string().max(20_000).optional(),
  places: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  highlight: z.string().max(300).optional(),
  /** null unlinks the folder (the photos themselves stay in the Album). */
  folderId: z.string().min(1).max(200).nullable().optional(),
  folderName: z.string().max(200).optional(),
  mood: z.string().max(8).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  who: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  food: z.array(z.object({
    id: z.string().min(1).max(40), name: z.string().trim().min(1).max(120), dish: z.string().trim().max(160).optional(),
    rating: z.number().int().min(1).max(5).optional(), goBack: z.boolean().optional(),
  })).max(60).optional(),
  favourites: z.array(z.string().min(1).max(200)).max(4).optional(),
});

/** PUT /api/trips/:id/days/:day — save any part of one day's journal (merge). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; day: string }> }) {
  try {
    const user = await requireUser();
    const { id, day: dayStr } = await ctx.params;
    const day = Number(dayStr);
    const trip = await getTrip(id);
    if (!Number.isInteger(day) || day < 1 || day > trip.days) throw new HttpError("No such day in this trip");
    const body = Body.parse(await req.json());

    // A linked folder must be inside the Album library (same check the Album itself uses).
    if (body.folderId) await breadcrumbs(body.folderId, rootId());

    const { folderId, folderName, mood, rating, ...rest } = body;
    await daysCol(id).doc(String(day)).set(
      {
        tripId: id,
        day,
        ...rest,
        ...(folderId === null ? { folderId: FieldValue.delete(), folderName: FieldValue.delete() } : {}),
        ...(folderId ? { folderId, folderName: folderName ?? "" } : {}),
        ...(mood === null ? { mood: FieldValue.delete() } : mood ? { mood } : {}),
        ...(rating === null ? { rating: FieldValue.delete() } : rating ? { rating } : {}),
        updatedAt: Date.now(),
        updatedBy: user.email,
      },
      { merge: true },
    );
    return ok({ day });
  } catch (e) {
    return fail(e);
  }
}
