import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { getTrip, tripsCol } from "@/lib/trips/store";
import type { Trip } from "@/lib/trips/types";

export const runtime = "nodejs";

const PARTS = ["packing", "todos", "plan", "stays", "links", "bookings"] as const;
const Body = z.object({ sourceId: z.string().min(1), parts: z.array(z.enum(PARTS)).min(1) });

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const key = (s: string) => s.trim().toLowerCase();

/**
 * POST { sourceId, parts } — reuse lists from an earlier trip: packing and
 * to-dos come back unticked, itinerary items as ideas (on the same day number
 * if this trip has it, else unscheduled), stays as options, bookings without
 * dates or PNRs. Anything already on this trip (same text/title) is skipped.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const { sourceId, parts } = Body.parse(await req.json());
    const [trip, src] = await Promise.all([getTrip(id), getTrip(sourceId)]);
    const patch: Partial<Trip> = {};
    const added: Record<string, number> = {};

    if (parts.includes("packing")) {
      const have = new Set(trip.packing.map((p) => key(p.text)));
      const add = src.packing.filter((p) => !have.has(key(p.text))).map((p) => ({ id: newId(), text: p.text, done: false }));
      patch.packing = [...trip.packing, ...add];
      added.packing = add.length;
    }
    if (parts.includes("todos")) {
      const have = new Set(trip.todos.map((t) => key(t.text)));
      const add = src.todos.filter((t) => !have.has(key(t.text))).map((t) => ({ id: newId(), text: t.text, done: false }));
      patch.todos = [...trip.todos, ...add];
      added.todos = add.length;
    }
    if (parts.includes("plan")) {
      const have = new Set(trip.plan.map((p) => key(p.title)));
      const add = src.plan.filter((p) => !have.has(key(p.title))).map((p) => ({
        ...p, id: newId(), status: "idea" as const, votes: [], ...(p.day && p.day <= trip.days ? { day: p.day } : { day: undefined }),
      }));
      patch.plan = [...trip.plan, ...add];
      added.plan = add.length;
    }
    if (parts.includes("stays")) {
      const have = new Set(trip.stays.map((s) => key(s.name)));
      const add = src.stays.filter((s) => !have.has(key(s.name))).map((s) => ({ ...s, id: newId(), status: "option" as const, votes: [] }));
      patch.stays = [...trip.stays, ...add];
      added.stays = add.length;
    }
    if (parts.includes("links")) {
      const have = new Set(trip.links.map((l) => l.url.trim()));
      const add = src.links.filter((l) => !have.has(l.url.trim())).map((l) => ({ ...l, id: newId() }));
      patch.links = [...trip.links, ...add];
      added.links = add.length;
    }
    if (parts.includes("bookings")) {
      const have = new Set(trip.bookings.map((b) => key(b.title)));
      const add = src.bookings.filter((b) => !have.has(key(b.title))).map((b) => ({ id: newId(), kind: b.kind, title: b.title, ...(b.link ? { link: b.link } : {}), ...(b.notes ? { notes: b.notes } : {}) }));
      patch.bookings = [...trip.bookings, ...add];
      added.bookings = add.length;
    }

    // Firestore rejects undefined inside arrays of objects unless ignoreUndefinedProperties is on (it is) — strip anyway for clean docs.
    const clean = JSON.parse(JSON.stringify(patch));
    await tripsCol().doc(id).update({ ...clean, updatedAt: Date.now() });
    return ok({ added });
  } catch (e) {
    return fail(e);
  }
}
