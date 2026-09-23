import { FieldValue, type Transaction } from "@google-cloud/firestore";
import { db } from "@/lib/firestore";
import type { MoneyMonthSummary, MoneySettings, MoneyTxType } from "@/lib/types";

/**
 * Dates are already plain Asia/Kolkata calendar strings everywhere in this app
 * (e.g. Bills' nextDueDate) — no Date object or timezone conversion needed, just
 * string arithmetic on the YYYY-MM-DD parts. Server-only: the client never sends
 * or decides monthKey.
 */
export function computeMonthKey(dateISO: string, monthStartDay: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  let year = y;
  let month = m; // 1-12
  if (monthStartDay > 1 && d < monthStartDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const emptySummary = (monthKey: string): MoneyMonthSummary => ({
  monthKey,
  incomePaise: 0,
  expensePaise: 0,
  savingPaise: 0,
  surplusPaise: 0,
  carryInPaise: 0,
  leftPaise: 0,
  byGroup: {},
  byCategory: {},
  byMode: {},
  txCount: 0,
  updatedAt: Date.now(),
});

export async function getSettings(): Promise<MoneySettings> {
  const snap = await db().collection("money_settings").doc("main").get();
  if (snap.exists) return snap.data() as MoneySettings;
  return { monthStartDay: 1, currency: "INR", openingBalancePaise: 0, updatedAt: 0 };
}

export type TxDeltaInput = { type: MoneyTxType; amountPaise: number; group: string; categoryId: string; mode?: string };
export type MonthDeltaPlan = { monthKey: string; ops: { input: TxDeltaInput; sign: 1 | -1 }[] };

const add = (rec: Record<string, number>, key: string, delta: number) => {
  rec[key] = (rec[key] ?? 0) + delta;
  if (rec[key] === 0) delete rec[key];
};

/**
 * The one primitive everything else in this file is built from. Takes one
 * plan per month that needs touching (usually 1, sometimes 2 — an edit that
 * moves a transaction's date across a month boundary touches both the old
 * and new month). Reads every plan's month doc (and, where needed, the
 * previous month for carryIn) up front via Promise.all, THEN computes and
 * writes every summary — because Firestore transactions require ALL reads
 * across the whole transaction to happen before ANY writes, not just before
 * that same call's own writes. Two sequential read-then-write calls for two
 * different months would violate that the moment the second one reads after
 * the first one wrote.
 */
export async function applyMonthDeltas(t: Transaction, plans: MonthDeltaPlan[]): Promise<void> {
  const monthRefs = plans.map((p) => db().collection("money_months").doc(p.monthKey));
  const snaps = await Promise.all(monthRefs.map((ref) => t.get(ref)));
  const needsCarryIn = snaps.map((s) => !s.exists);

  const prevRefs = plans.map((p) => db().collection("money_months").doc(previousMonthKey(p.monthKey)));
  const prevSnaps = await Promise.all(
    plans.map((_, i) => (needsCarryIn[i] ? t.get(prevRefs[i]) : Promise.resolve(null))),
  );
  const settings = needsCarryIn.some(Boolean) ? await getSettings() : null;

  plans.forEach((plan, i) => {
    const snap = snaps[i];
    const summary = snap.exists ? (snap.data() as MoneyMonthSummary) : emptySummary(plan.monthKey);

    for (const { input, sign } of plan.ops) {
      const signed = sign * input.amountPaise;
      if (input.type === "income") summary.incomePaise += signed;
      else if (input.type === "expense") summary.expensePaise += signed;
      else if (input.type === "saving") summary.savingPaise += signed;
      // transfer touches neither total, per spec — excluded from all totals.
      add(summary.byGroup, input.group, signed);
      add(summary.byCategory, input.categoryId, signed);
      if (input.mode) add(summary.byMode, input.mode, signed);
      summary.txCount += sign;
    }
    summary.surplusPaise = summary.incomePaise - summary.expensePaise - summary.savingPaise;

    if (needsCarryIn[i]) {
      const prevSnap = prevSnaps[i]!;
      summary.carryInPaise = prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary).leftPaise : settings!.openingBalancePaise;
    }
    summary.leftPaise = summary.carryInPaise + summary.surplusPaise;
    summary.updatedAt = Date.now();

    t.set(monthRefs[i], summary);
    for (const { input, sign } of plan.ops) {
      t.set(db().collection("money_categories").doc(input.categoryId), { useCount: FieldValue.increment(sign) }, { merge: true });
    }
  });
}

/** Single month, single op — plain create or delete. */
export function applyTxDelta(t: Transaction, monthKey: string, input: TxDeltaInput, sign: 1 | -1): Promise<void> {
  return applyMonthDeltas(t, [{ monthKey, ops: [{ input, sign }] }]);
}

/** Single month, multiple ops — an edit whose date stays within the same month (old value out, new value in, one read+write instead of two). */
export function applyTxDeltas(t: Transaction, monthKey: string, ops: { input: TxDeltaInput; sign: 1 | -1 }[]): Promise<void> {
  return applyMonthDeltas(t, [{ monthKey, ops }]);
}

/** Rebuilds a month's summary from scratch by scanning its transactions — the repair path, and what tests check the live delta math against. */
export async function recomputeMonth(monthKey: string): Promise<MoneyMonthSummary> {
  const txSnap = await db().collection("money_tx").where("monthKey", "==", monthKey).get();
  const summary = emptySummary(monthKey);

  const catCache = new Map<string, string>(); // categoryId -> group
  for (const doc of txSnap.docs) {
    const tx = doc.data();
    if (!catCache.has(tx.categoryId)) {
      const catSnap = await db().collection("money_categories").doc(tx.categoryId).get();
      catCache.set(tx.categoryId, catSnap.exists ? (catSnap.data()!.group as string) : "Miscellaneous");
    }
    const group = catCache.get(tx.categoryId)!;
    if (tx.type === "income") summary.incomePaise += tx.amountPaise;
    else if (tx.type === "expense") summary.expensePaise += tx.amountPaise;
    else if (tx.type === "saving") summary.savingPaise += tx.amountPaise;
    add(summary.byGroup, group, tx.amountPaise);
    add(summary.byCategory, tx.categoryId, tx.amountPaise);
    if (tx.mode) add(summary.byMode, tx.mode, tx.amountPaise);
    summary.txCount += 1;
  }
  summary.surplusPaise = summary.incomePaise - summary.expensePaise - summary.savingPaise;

  const prevSnap = await db().collection("money_months").doc(previousMonthKey(monthKey)).get();
  summary.carryInPaise = prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary).leftPaise : (await getSettings()).openingBalancePaise;
  summary.leftPaise = summary.carryInPaise + summary.surplusPaise;
  summary.updatedAt = Date.now();

  await db().collection("money_months").doc(monthKey).set(summary);
  return summary;
}
