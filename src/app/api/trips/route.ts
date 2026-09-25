import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { endDateOf } from "@/lib/trips/logic";
import { normalizeTrip, TripFields, tripsCol } from "@/lib/trips/store";
import { PACKING_STARTER, TODO_STARTER, type Trip, type TripSummary } from "@/lib/trips/types";
import type { MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/trips — every trip with how much has been spent on it (linked Money expenses, any month). */
export async function GET() {
  try {
    await requireUser();
    const [tripsSnap, txSnap] = await Promise.all([
      tripsCol().get(),
      db().collection("money_tx").where("tripId", "!=", null).get(),
    ]);
    const spent = new Map<string, { paise: number; count: number }>();
    for (const d of txSnap.docs) {
      const t = d.data() as MoneyTx;
      if (!t.tripId || (t.type !== "expense" && t.type !== "income")) continue;
      // Net cost: expenses minus refunds (income linked to the trip).
      const cur = spent.get(t.tripId) ?? { paise: 0, count: 0 };
      spent.set(t.tripId, t.type === "expense" ? { paise: cur.paise + t.amountPaise, count: cur.count + 1 } : { ...cur, paise: cur.paise - t.amountPaise });
    }
    const items: TripSummary[] = tripsSnap.docs
      .map((d) => normalizeTrip(d.data() as Trip))
      .map((t) => ({ ...t, spentPaise: spent.get(t.id)?.paise ?? 0, expenseCount: spent.get(t.id)?.count ?? 0 }))
      .sort((a, b) => (b.startDate ?? "9999").localeCompare(a.startDate ?? "9999"));
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

/** POST /api/trips — create (dates optional: an idea). Packing and to-dos start from sensible defaults you can edit. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = TripFields.parse(await req.json());
    const ref = tripsCol().doc();
    const now = Date.now();
    const trip: Trip = {
      id: ref.id,
      name: body.name,
      destination: body.destination,
      ...(body.startDate ? { startDate: body.startDate, endDate: endDateOf(body.startDate, body.days) } : {}),
      days: body.days,
      travellers: body.travellers,
      ...(body.budgetRupees ? { budgetRupees: body.budgetRupees } : {}),
      budgetPlan: body.budgetPlan,
      notes: body.notes,
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.rate ? { rate: body.rate } : {}),
      bookings: body.bookings,
      packing: body.packing.length ? body.packing : PACKING_STARTER.map((text, i) => ({ id: `p${i}`, text, done: false })),
      todos: body.todos.length ? body.todos : TODO_STARTER.map((text, i) => ({ id: `t${i}`, text, done: false })),
      plan: body.plan,
      stays: body.stays,
      links: body.links,
      shared: body.shared,
      settlements: body.settlements,
      upi: body.upi,
      cash: body.cash,
      receipts: [],
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(trip);
    return ok({ trip });
  } catch (e) {
    return fail(e);
  }
}
