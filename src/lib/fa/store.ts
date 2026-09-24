import { db } from "@/lib/firestore";
import { computeDayTotals, dayStatus, todayIST } from "@/lib/fa/day";
import { burnedKcal } from "@/lib/fa/targets";
import type { FaActivity, FaDay, FaEntry, FaFood, FaProfile } from "@/lib/fa/types";

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
): FaDay {
  const base = prev ?? emptyDay(person, date);
  const totals = computeDayTotals(entries);
  const steps = activity?.steps ?? base.steps;
  const workoutMin = activity?.workoutMin ?? base.workoutMin;
  const act = activity ? activity.activity : base.activity;
  const burned = burnedKcal({ steps, workoutMin, activity: act, weightKg: profile?.weightKg ?? 70 });
  const targetKcal = profile?.targetKcal ?? null;
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
): Promise<FaDay> {
  const entriesQ = db().collection(COL.entries).where("person", "==", person).where("date", "==", date);
  const dayRef = db().collection(COL.days).doc(dayId(person, date));
  const profileRef = db().collection(COL.profiles).doc(person);

  return db().runTransaction(async (t) => {
    const [entriesSnap, daySnap, profileSnap] = await Promise.all([t.get(entriesQ), t.get(dayRef), t.get(profileRef)]);
    const current = entriesSnap.docs.map((d) => d.data() as FaEntry);
    const { upserts = [], deletes = [] } = change(current);

    const byId = new Map(current.map((e) => [e.id, e]));
    for (const id of deletes) byId.delete(id);
    for (const e of upserts) byId.set(e.id, e);

    const day = buildDay(
      daySnap.exists ? (daySnap.data() as FaDay) : null,
      person,
      date,
      [...byId.values()],
      profileSnap.exists ? (profileSnap.data() as FaProfile) : null,
    );

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
export async function refreshToday(person: string, profile: FaProfile) {
  const date = todayIST();
  const dayRef = db().collection(COL.days).doc(dayId(person, date));
  const entriesQ = db().collection(COL.entries).where("person", "==", person).where("date", "==", date);
  await db().runTransaction(async (t) => {
    const [daySnap, entriesSnap] = await Promise.all([t.get(dayRef), t.get(entriesQ)]);
    if (!daySnap.exists && entriesSnap.empty) return;
    t.set(dayRef, buildDay(daySnap.exists ? (daySnap.data() as FaDay) : null, person, date, entriesSnap.docs.map((d) => d.data() as FaEntry), profile));
  });
}
