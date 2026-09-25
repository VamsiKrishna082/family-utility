import { requireUser } from "@/lib/auth";
import { personForEmail } from "@/lib/fa/people";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { IdeaFields } from "@/lib/trips/ideas";
import type { TripIdea } from "@/lib/trips/types";

export const runtime = "nodejs";

/** GET — "someday" places, most-voted first. */
export async function GET() {
  try {
    const user = await requireUser();
    const snap = await db().collection("trip_ideas").get();
    const items = snap.docs.map((d) => d.data() as TripIdea).sort((a, b) => (b.votes?.length ?? 0) - (a.votes?.length ?? 0) || b.createdAt - a.createdAt);
    return ok({ items, me: personForEmail(user.email) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = IdeaFields.parse(await req.json());
    const ref = db().collection("trip_ideas").doc();
    const now = Date.now();
    const idea: TripIdea = { ...body, id: ref.id, createdBy: user.email, createdAt: now, updatedAt: now };
    await ref.set(idea);
    return ok({ idea });
  } catch (e) {
    return fail(e);
  }
}
