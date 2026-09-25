import { requireUser } from "@/lib/auth";
import { listFolder, rootId } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import { dateOfDay, matchFolders } from "@/lib/trips/logic";
import { daysCol, getTrip, readDay } from "@/lib/trips/store";

export const runtime = "nodejs";

const MAX_FOLDERS = 120;
const MAX_DEPTH = 4;
const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * GET — Album folders whose photos were taken on each (unlinked) day of the
 * trip, by the photos' capture dates. Walks the Album tree breadth-first
 * (a few levels, capped) using the same cached folder listings the Album
 * itself uses, so repeated calls are cheap.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    if (!trip.startDate) return ok({ items: [], scanned: 0 });
    const daysSnap = await daysCol(id).get();
    const linked = new Set(daysSnap.docs.map((d) => readDay(d.data())).filter((d) => d.folderId).map((d) => d.day));
    const dayDates = Array.from({ length: trip.days }, (_, i) => ({ day: i + 1, date: dateOfDay(trip.startDate!, i + 1) })).filter((d) => !linked.has(d.day));
    if (!dayDates.length) return ok({ items: [], scanned: 0 });

    const wanted = new Set(dayDates.map((d) => d.date));
    const folders: { folderId: string; folderName: string; path: string; photoDates: string[] }[] = [];
    const queue: { id: string; name: string; path: string; depth: number }[] = [{ id: rootId(), name: "Album", path: "", depth: 0 }];
    // Look inside the trip's own Album folder first if it has one.
    if (trip.albumFolderId) queue.unshift({ id: trip.albumFolderId, name: trip.name, path: trip.name, depth: 1 });
    const seen = new Set<string>();
    let scanned = 0;

    while (queue.length && scanned < MAX_FOLDERS) {
      const f = queue.shift()!;
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      scanned++;
      const entries = await listFolder(f.id).catch(() => []);
      const photoDates = entries.filter((e) => e.kind !== "folder").map((e) => istDate(e.createdTime));
      if (f.depth > 0 && photoDates.some((d) => wanted.has(d))) folders.push({ folderId: f.id, folderName: f.name, path: f.path, photoDates });
      if (f.depth < MAX_DEPTH) {
        for (const e of entries.filter((x) => x.kind === "folder")) queue.push({ id: e.id, name: e.name, path: f.path ? `${f.path} / ${e.name}` : e.name, depth: f.depth + 1 });
      }
    }
    return ok({ items: matchFolders(dayDates, folders), scanned });
  } catch (e) {
    return fail(e);
  }
}
