import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { breadcrumbs, createFolder, rootId } from "@/lib/drive";
import { dateOfDay, dayLabel } from "@/lib/trips/logic";
import { daysCol, getTrip, tripsCol } from "@/lib/trips/store";
import type { TripDay } from "@/lib/trips/types";

export const runtime = "nodejs";

const Body = z.object({ parentId: z.string().min(1).nullable() });

/**
 * POST { parentId } — creates the trip's Album folders in one go:
 * "<Trip name>" under parentId (Album root if null), with a "Day N – Fri 12
 * Dec" folder inside for every day that doesn't already have a folder
 * linked, and links each one to its day. Upload photos into them from the
 * Album as usual. Days that already have a folder are left alone.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { parentId } = Body.parse(await req.json());
    const trip = await getTrip(id);
    const parent = parentId ?? rootId();
    await breadcrumbs(parent, rootId());

    const tripFolderId = trip.albumFolderId ?? (await createFolder(trip.name, parent)).id;
    if (!trip.albumFolderId) await tripsCol().doc(id).update({ albumFolderId: tripFolderId, updatedAt: Date.now() });

    const daysSnap = await daysCol(id).get();
    const linked = new Set(daysSnap.docs.map((d) => d.data() as TripDay).filter((d) => d.folderId).map((d) => d.day));
    let created = 0;
    for (let day = 1; day <= trip.days; day++) {
      if (linked.has(day)) continue;
      const name = trip.startDate ? `Day ${day} – ${dayLabel(dateOfDay(trip.startDate, day))}` : `Day ${day}`;
      const folder = await createFolder(name, tripFolderId);
      await daysCol(id).doc(String(day)).set(
        { tripId: id, day, folderId: folder.id, folderName: name, updatedAt: Date.now(), updatedBy: user.email },
        { merge: true },
      );
      created++;
    }
    return ok({ tripFolderId, created });
  } catch (e) {
    return fail(e);
  }
}
