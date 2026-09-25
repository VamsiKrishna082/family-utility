import { FieldValue } from "@google-cloud/firestore";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { dayHasContent, endDateOf } from "@/lib/trips/logic";
import { daysCol, emptyDay, getTrip, HttpError, TripFields, tripsCol } from "@/lib/trips/store";
import type { TripDay } from "@/lib/trips/types";

export const runtime = "nodejs";

/** GET — the trip plus every day of its journal (missing days come back empty). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const [trip, daysSnap] = await Promise.all([getTrip(id), daysCol(id).get()]);
    const byNum = new Map(daysSnap.docs.map((d) => [(d.data() as TripDay).day, d.data() as TripDay]));
    const days = Array.from({ length: trip.days }, (_, i) => byNum.get(i + 1) ?? emptyDay(id, i + 1));
    // Days beyond the current length that still hold writing/photos (the trip was shortened with "keep").
    const hidden = [...byNum.values()].filter((d) => d.day > trip.days && dayHasContent(d)).map((d) => d.day);
    return ok({ trip, days, hiddenDays: hidden });
  } catch (e) {
    return fail(e);
  }
}

const Patch = TripFields.partial().extend({ confirmDropDays: z.boolean().optional() });

/**
 * PATCH — any trip fields. Shortening a trip never deletes a day's journal:
 * if the days being cut have anything written or linked, the request is
 * refused (409, with which days) unless confirmDropDays is set — and even
 * then those day documents are kept, just hidden, so lengthening the trip
 * again brings them back.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const { confirmDropDays, ...patch } = Patch.parse(await req.json());
    const trip = await getTrip(id);

    const startDate = patch.startDate === null ? undefined : (patch.startDate ?? trip.startDate);
    const days = patch.days ?? trip.days;
    if (days < trip.days && !confirmDropDays) {
      const snap = await daysCol(id).where("day", ">", days).get();
      const withContent = snap.docs.map((d) => d.data() as TripDay).filter(dayHasContent).map((d) => d.day).sort((a, b) => a - b);
      if (withContent.length) {
        throw new HttpError(`Day ${withContent.join(", ")} ${withContent.length === 1 ? "has" : "have"} writing or photos`, 409, { days: withContent });
      }
    }

    const update: Record<string, unknown> = {
      ...patch,
      endDate: startDate ? endDateOf(startDate, days) : FieldValue.delete(),
      updatedAt: Date.now(),
    };
    // null clears an optional field (a start date of null turns the trip back into an idea)
    for (const k of ["startDate", "budgetRupees", "coverPhotoId", "currency", "rate"] as const) {
      if (patch[k] === null) update[k] = FieldValue.delete();
    }
    await tripsCol().doc(id).update(update);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

/**
 * DELETE — removes the trip and its journal. Linked Money expenses are NOT
 * deleted; they just stop pointing at the trip. Album photos are untouched.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const [daysSnap, txSnap] = await Promise.all([daysCol(id).get(), db().collection("money_tx").where("tripId", "==", id).get()]);
    const batch = db().batch();
    daysSnap.docs.forEach((d) => batch.delete(d.ref));
    txSnap.docs.forEach((d) => batch.update(d.ref, { tripId: FieldValue.delete() }));
    batch.delete(tripsCol().doc(id));
    await batch.commit();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}
