import { db } from "@/lib/firestore";
import { computeDayTotals, dayStatus, todayIST } from "@/lib/fa/day";
import { burnedKcal, effectiveTarget, limitCheck } from "@/lib/fa/targets";
import { BadRequest } from "@/lib/fa/auth";
import type { FaActivity, FaDay, FaEntry, FaFood, FaLimit, FaProfile } from "@/lib/fa/types";

/**
 * Collections (food.md "Data model"). All server-side via the Admin SDK, same
 * as every other section; the allowlist in requireUser() is the only gate.
 */
export const COL = {
  profiles: "fa_profiles",
  days: "fa_days",
  entries: "fa_entries",
  foods: "foods",
  overrides: "food_overrides",
  favourites: "fa_favourites",
  weights: "fa_weights",
  limits: "fa_limits",
} as const;

export const dayId = (person: string, date: string) => `${person}_${date}`;
/** Food keys contain ":" (fine in a doc id) and never "/"; replaced defensively anyway. */
export const foodDocId = (key: string) => key.replace(/\//g, "_");
export const personFoodId = (person: string, key: string) => `${person}__${foodDocId(key)}`;

export async function getProfile(person: string): Promise<FaProfile | null> {
  const snap = await db().collection(COL.profiles).doc(person).get();
  return snap.exists ? (snap.data() as FaProfile) : null;
}

export function emptyDay(person: string, date: string): FaDay {
  return {
    person, date, kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0,
    eatenKcal: 0, burnedKcal: 0, netKcal: 0, entryCount: 0,
    steps: 0, stepsSource: "manual", workoutMin: 0,
    status: "none", targetKcal: null, proteinTargetG: null, updatedAt: Date.now(),
  };
}

/**
 * Rebuilds a day doc from its full entry list plus its activity fields —
 * never an incremental delta — so "day totals equal a recompute from
 * entries" holds by construction.
 */
export function buildDay(
  prev: FaDay | null,
  person: string,
  date: string,
  entries: FaEntry[],
  profile: FaProfile | null,
  activity?: { steps: number; workoutMin: number; activity?: FaActivity },
  limit: FaLimit | null = null,
): FaDay {
  const base = prev ?? emptyDay(person, date);
  const totals = computeDayTotals(entries);
  const steps = activity?.steps ?? base.steps;
  const workoutMin = activity?.workoutMin ?? base.workoutMin;
  const act = activity ? activity.activity : base.activity;
  const burned = burnedKcal({ steps, workoutMin, activity: act, weightKg: profile?.weightKg ?? 70 });
  const targetKcal = effectiveTarget(profile, limit).target;
  return {
    ...base,
    person,
    date,
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fibre: totals.fibre,
    entryCount: totals.entryCount,
    eatenKcal: totals.kcal,
    burnedKcal: burned,
    netKcal: totals.kcal - burned,
    steps,
    workoutMin,
    activity: act,
    stepsSource: "manual",
    targetKcal,
    proteinTargetG: profile?.proteinG ?? null,
    status: dayStatus({ entryCount: totals.entryCount, eatenKcal: totals.kcal, burnedKcal: burned, targetKcal }),
    updatedAt: Date.now(),
  };
}

/**
 * Applies one entry change and rewrites that day's doc in the same
 * transaction. Reads (the day's entries, day doc, profile) all happen before
 * any write, per Firestore's transaction rule; the change is applied to the
 * in-memory list first, then everything is written.
 */
export async function changeEntries(
  person: string,
  date: string,
  change: (current: FaEntry[]) => { upserts?: FaEntry[]; deletes?: string[] },
  opts: { force?: boolean } = {},
): Promise<FaDay> {
  const entriesQ = db().collection(COL.entries).where("person", "==", person).where("date", "==", date);
  const dayRef = db().collection(COL.days).doc(dayId(person, date));
  const profileRef = db().collection(COL.profiles).doc(person);
  const limitRef = db().collection(COL.limits).doc(person);

  return db().runTransaction(async (t) => {
    const [entriesSnap, daySnap, profileSnap, limitSnap] = await Promise.all([t.get(entriesQ), t.get(dayRef), t.get(profileRef), t.get(limitRef)]);
    const profile = profileSnap.exists ? (profileSnap.data() as FaProfile) : null;
    const limit = limitSnap.exists ? (limitSnap.data() as FaLimit) : null;
    const current = entriesSnap.docs.map((d) => d.data() as FaEntry);
    const { upserts = [], deletes = [] } = change(current);

    const byId = new Map(current.map((e) => [e.id, e]));
    for (const id of deletes) byId.delete(id);
    for (const e of upserts) byId.set(e.id, e);

    const day = buildDay(daySnap.exists ? (daySnap.data() as FaDay) : null, person, date, [...byId.values()], profile, undefined, limit);

    // Your own limit, in "block" mode: food that would take the day past it isn't logged.
    const before = current.reduce((s, e) => s + e.kcal, 0);
    if (!opts.force && limitCheck(before, day.eatenKcal, day.targetKcal, limit?.mode) === "block") {
      const room = Math.max(0, (day.targetKcal ?? 0) - before);
      throw new BadRequest(
        `Not logged — that would take today to ${Math.round(day.eatenKcal).toLocaleString("en-IN")} kcal, over your ${Math.round(day.targetKcal!).toLocaleString("en-IN")} kcal limit. ${room ? `You have ${Math.round(room).toLocaleString("en-IN")} kcal left.` : "You've reached it for today."}`,
        409,
      );
    }

    for (const id of deletes) t.delete(db().collection(COL.entries).doc(id));
    for (const e of upserts) t.set(db().collection(COL.entries).doc(e.id), e);
    t.set(dayRef, day);
    return day;
  });
}

/** Caches a fetched food (Open Food Facts / USDA / AI) so the same item is instant and free next time. */
export async function cacheFood(food: FaFood): Promise<void> {
  if (food.source === "local" || food.source === "yours") return;
  const ref = db().collection(COL.foods).doc(foodDocId(food.key));
  await ref.set({ ...stripClientFields(food), updatedAt: Date.now() }, { merge: true });
}

export function stripClientFields(food: FaFood): FaFood {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { favourite, editedAt, sourceBase, ...rest } = food;
  return rest;
}

/** Re-judges today against the new target; past days keep the target they were logged against. */
export async function getLimit(person: string): Promise<FaLimit | null> {
  const snap = await db().collection(COL.limits).doc(person).get();
  return snap.exists ? (snap.data() as FaLimit) : null;
}

export async function refreshToday(person: string, profile: FaProfile | null) {
  const date = todayIST();
  const dayRef = db().collection(COL.days).doc(dayId(person, date));
  const entriesQ = db().collection(COL.entries).where("person", "==", person).where("date", "==", date);
  const limitRef = db().collection(COL.limits).doc(person);
  await db().runTransaction(async (t) => {
    const [daySnap, entriesSnap, limitSnap] = await Promise.all([t.get(dayRef), t.get(entriesQ), t.get(limitRef)]);
    if (!daySnap.exists && entriesSnap.empty) return;
    const limit = limitSnap.exists ? (limitSnap.data() as FaLimit) : null;
    t.set(dayRef, buildDay(daySnap.exists ? (daySnap.data() as FaDay) : null, person, date, entriesSnap.docs.map((d) => d.data() as FaEntry), profile, undefined, limit));
  });
}
