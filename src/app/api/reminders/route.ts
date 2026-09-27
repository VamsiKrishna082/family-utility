import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { loadUpcoming } from "@/lib/remindersData";

export const runtime = "nodejs";

/** GET — what's coming up (dates, renewals, trips, card dues), for the Home "Today" card. */
export async function GET() {
  try {
    await requireUser();
    return ok({ items: await loadUpcoming() });
  } catch (e) {
    return fail(e);
  }
}
