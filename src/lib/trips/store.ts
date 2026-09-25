import { z } from "zod";
import { db } from "@/lib/firestore";
import { BUDGET_KEYS, PLAN_STATUSES, STAY_STATUSES, TRIP_BOOKING_KINDS, type Trip, type TripDay, type TripExpense } from "@/lib/trips/types";
import type { MoneyCategory, MoneyTx } from "@/lib/types";

export const tripsCol = () => db().collection("trips");
export const daysCol = (tripId: string) => tripsCol().doc(tripId).collection("days");

export class HttpError extends Response {
  constructor(message: string, status = 400, extra: Record<string, unknown> = {}) {
    super(JSON.stringify({ error: message, ...extra }), { status, headers: { "Content-Type": "application/json" } });
  }
}

export async function getTrip(id: string): Promise<Trip> {
  const snap = await tripsCol().doc(id).get();
  if (!snap.exists) throw new HttpError("Trip not found", 404);
  return normalizeTrip(snap.data() as Trip);
}

/** Fills the planner lists a record might not have yet, so callers never see undefined arrays. */
export function normalizeTrip(t: Trip): Trip {
  return {
    ...t,
    travellers: t.travellers ?? ["Us"],
    budgetPlan: t.budgetPlan ?? {},
    bookings: t.bookings ?? [],
    packing: t.packing ?? [],
    plan: t.plan ?? [],
    stays: t.stays ?? [],
    links: t.links ?? [],
    todos: t.todos ?? [],
    shared: t.shared ?? [],
    notes: t.notes ?? "",
  };
}

export function emptyDay(tripId: string, day: number): TripDay {
  return { tripId, day, title: "", story: "", places: [], highlight: "", updatedAt: 0, updatedBy: "" };
}

/**
 * A day doc with every field present. Linking a photo folder (or "Create
 * Album folders") writes only the folder fields, so a day that was never
 * written has no title/story/places yet — always read days through here.
 */
export function readDay(data: FirebaseFirestore.DocumentData): TripDay {
  const d = data as Partial<TripDay> & { tripId: string; day: number };
  return { ...emptyDay(d.tripId, d.day), ...d, places: d.places ?? [], title: d.title ?? "", story: d.story ?? "", highlight: d.highlight ?? "" };
}

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Id = z.string().min(1).max(40);
const Rupees = z.number().min(0).max(100_000_000);
const Url = z.string().trim().max(1000);

export const TripFields = z.object({
  name: z.string().trim().min(1).max(80),
  destination: z.string().trim().max(80).default(""),
  /** null/absent = an idea with no dates yet. */
  startDate: DateStr.nullable().optional(),
  days: z.number().int().min(1).max(90).default(3),
  travellers: z.array(z.string().trim().min(1).max(40)).max(20).default(["Us"]),
  budgetRupees: Rupees.nullable().optional(),
  budgetPlan: z.record(z.enum(BUDGET_KEYS), Rupees).default({}),
  notes: z.string().max(4000).default(""),
  coverPhotoId: z.string().max(200).nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
  rate: z.number().positive().max(100_000).nullable().optional(),
  bookings: z.array(z.object({
    id: Id, kind: z.enum(TRIP_BOOKING_KINDS), title: z.string().trim().min(1).max(120),
    date: DateStr.optional(), time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    confirmation: z.string().trim().max(80).optional(), link: Url.optional(), notes: z.string().max(500).optional(),
  })).max(100).default([]),
  packing: z.array(z.object({ id: Id, text: z.string().trim().min(1).max(120), done: z.boolean() })).max(300).default([]),
  plan: z.array(z.object({
    id: Id, day: z.number().int().min(1).max(90).optional(), time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    title: z.string().trim().min(1).max(160), place: z.string().trim().max(120).optional(), link: Url.optional(),
    notes: z.string().max(1000).optional(), estimateRupees: Rupees.optional(), status: z.enum(PLAN_STATUSES),
  })).max(300).default([]),
  stays: z.array(z.object({
    id: Id, name: z.string().trim().min(1).max(120), link: Url.optional(), area: z.string().trim().max(80).optional(),
    pricePerNightRupees: Rupees.optional(), nights: z.number().int().min(1).max(90).optional(),
    rating: z.number().int().min(1).max(5).optional(), pros: z.string().max(500).optional(), cons: z.string().max(500).optional(),
    status: z.enum(STAY_STATUSES),
  })).max(60).default([]),
  links: z.array(z.object({ id: Id, title: z.string().trim().min(1).max(160), url: Url.min(1), note: z.string().max(500).optional() })).max(200).default([]),
  todos: z.array(z.object({ id: Id, text: z.string().trim().min(1).max(160), due: DateStr.optional(), done: z.boolean() })).max(200).default([]),
  shared: z.array(z.object({
    id: Id, date: DateStr.optional(), title: z.string().trim().min(1).max(120), amount: z.number().min(0).max(100_000_000),
    paidBy: z.string().trim().min(1).max(40), splitAmong: z.array(z.string().trim().min(1).max(40)).max(20),
  })).max(500).default([]),
});

/** Money transactions linked to a trip, with their category names — for the trip's Expenses tab. */
export async function tripExpenses(tripId: string): Promise<TripExpense[]> {
  const [txSnap, catSnap] = await Promise.all([
    db().collection("money_tx").where("tripId", "==", tripId).get(),
    db().collection("money_categories").get(),
  ]);
  const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
  return txSnap.docs
    .map((d) => d.data() as MoneyTx)
    .filter((t) => t.type === "expense")
    .map((t) => toTripExpense(t, cats))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function toTripExpense(t: MoneyTx, cats: Map<string, MoneyCategory>): TripExpense {
  const c = cats.get(t.categoryId);
  return {
    id: t.id, date: t.date, amountPaise: t.amountPaise, categoryId: t.categoryId,
    categoryName: c?.name ?? "—", categoryGroup: c?.group ?? "", subcategory: t.subcategory,
    note: t.note, mode: t.mode, paidBy: t.paidBy,
  };
}
