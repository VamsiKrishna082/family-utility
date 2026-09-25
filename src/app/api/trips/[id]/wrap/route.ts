import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { wrapUp } from "@/lib/trips/logic";
import { dayPhotos, sharedDays } from "@/lib/trips/shared";
import { getTrip } from "@/lib/trips/store";

export const runtime = "nodejs";

/** GET — the trip's wrap-up: days written, places, photos across the day folders, best day, moods, best moments. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const trip = await getTrip(id);
    const days = await sharedDays(trip);
    const counts = await Promise.all(days.map(async (d) => [d.day, (await dayPhotos(d)).length] as const));
    return ok(wrapUp(days, Object.fromEntries(counts)));
  } catch (e) {
    return fail(e);
  }
}
