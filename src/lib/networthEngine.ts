import { db } from "@/lib/firestore";
import { effectiveGoldItemValuePaise, getGoldRate } from "@/lib/goldPrice";
import type { MoneyMonthSummary, NwAccount, NwGoldItem, NwSnapshot, NwUpdateRow } from "@/lib/types";

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  let year = y;
  let month = m + delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function currentMonthKey(): string {
  return todayInIndia().slice(0, 7);
}

const emptyTotals = () => ({ assetsPaise: 0, liabilitiesPaise: 0, netPaise: 0, byAssetClass: {} as Record<string, number> });

/**
 * Pure — no I/O, easy to check against a recompute. A loan's value is a
 * liability (subtracted from net, excluded from the asset-allocation
 * breakdown, which is only meaningful for actual assets). Archived accounts
 * are skipped even if they still carry a value in an old snapshot.
 */
export function computeTotals(values: Record<string, number>, accounts: NwAccount[]): NwSnapshot["totals"] {
  const totals = emptyTotals();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const [accountId, paise] of Object.entries(values)) {
    const account = byId.get(accountId);
    if (!account || account.archived) continue;
    if (account.kind === "loan") {
      totals.liabilitiesPaise += paise;
    } else {
      totals.assetsPaise += paise;
      if (account.assetClass) totals.byAssetClass[account.assetClass] = (totals.byAssetClass[account.assetClass] ?? 0) + paise;
    }
  }
  totals.netPaise = totals.assetsPaise - totals.liabilitiesPaise;
  return totals;
}

function emptySnapshot(monthKey: string): NwSnapshot {
  return { monthKey, values: {}, enteredBy: {}, updatedAt: 0, totals: emptyTotals() };
}

export async function getAccounts(): Promise<NwAccount[]> {
  const snap = await db().collection("nw_accounts").orderBy("order", "asc").get();
  return snap.docs.map((d) => d.data() as NwAccount);
}

export async function getSnapshot(monthKey: string): Promise<NwSnapshot | null> {
  const snap = await db().collection("nw_snapshots").doc(monthKey).get();
  return snap.exists ? (snap.data() as NwSnapshot) : null;
}

/**
 * Merges partialValues into whatever this month's snapshot already has (a
 * true partial save — rows you didn't touch keep their existing value) and
 * recomputes totals from the merged whole. One read-merge-write inside a
 * transaction, not a delta ledger like Money's — snapshots don't have
 * individual entries to replay, just "the value as of this month."
 *
 * On the FIRST save of a brand-new month, also seeds every account not part
 * of this save from last month's own stored values — so the stored snapshot
 * is a complete picture from day one of the month, not just "whatever's been
 * typed so far." Without this, a month you'd only partly updated (or hadn't
 * touched at all) would show its net worth as understated in its own stored
 * totals forever, since nothing else ever re-carries it forward. Later saves
 * within the same month skip this — existing.values is already complete.
 */
export async function saveSnapshotValues(monthKey: string, partialValues: Record<string, number>, enteredByEmail: string): Promise<NwSnapshot> {
  const ref = db().collection("nw_snapshots").doc(monthKey);
  return db().runTransaction(async (t) => {
    const [snap, accounts] = await Promise.all([t.get(ref), getAccounts()]);
    const isFirstSaveThisMonth = !snap.exists;
    const existing = snap.exists ? (snap.data() as NwSnapshot) : emptySnapshot(monthKey);

    let carriedValues: Record<string, number> = {};
    let carriedEnteredBy: Record<string, string> = {};
    if (isFirstSaveThisMonth) {
      const prevSnap = await t.get(db().collection("nw_snapshots").doc(previousMonthKey(monthKey)));
      if (prevSnap.exists) {
        const prev = prevSnap.data() as NwSnapshot;
        carriedValues = prev.values;
        carriedEnteredBy = prev.enteredBy;
      }
    }

    const values = { ...carriedValues, ...existing.values, ...partialValues };
    const enteredBy = { ...carriedEnteredBy, ...existing.enteredBy };
    for (const accountId of Object.keys(partialValues)) enteredBy[accountId] = enteredByEmail;

    const next: NwSnapshot = { monthKey, values, enteredBy, updatedAt: Date.now(), totals: computeTotals(values, accounts) };
    t.set(ref, next);
    return next;
  });
}

/**
 * Rows for the update-balances form: previous month's value as a greyed
 * hint, and this month's value pre-filled from the previous month if this
 * month hasn't been saved yet at all — nothing is written by opening the
 * form, only by saving it.
 *
 * Accounts with linkedToMoneyLeftover also get a suggestedValuePaise, read
 * from Money's own money_months/{monthKey}.leftPaise — offered as a
 * one-tap fill button in the UI, never auto-applied to the saved snapshot.
 * Uses the same literal monthKey string as Net Worth's calendar month;
 * if Money's monthStartDay isn't 1, Money's own month boundaries won't
 * line up with the calendar and this suggestion will be a rough one —
 * acceptable since it's only ever a suggestion, not a written value.
 */
export async function getUpdateFormRows(monthKey: string): Promise<NwUpdateRow[]> {
  const [accounts, thisSnap, prevSnap] = await Promise.all([
    getAccounts(),
    getSnapshot(monthKey),
    getSnapshot(previousMonthKey(monthKey)),
  ]);

  const needsMoneyLeftover = accounts.some((a) => a.linkedToMoneyLeftover && !a.archived);
  const moneyLeftPaise = needsMoneyLeftover
    ? await db().collection("money_months").doc(monthKey).get().then((d) => (d.exists ? (d.data() as MoneyMonthSummary).leftPaise : null))
    : null;

  const goalIds = [...new Set(accounts.filter((a) => a.linkedToMoneyGoalId && !a.archived).map((a) => a.linkedToMoneyGoalId!))];
  const goalSavedById = new Map<string, number>();
  if (goalIds.length > 0) {
    const goalSnaps = await Promise.all(goalIds.map((id) => db().collection("money_goals").doc(id).get()));
    goalSnaps.forEach((snap, i) => {
      if (snap.exists) goalSavedById.set(goalIds[i], snap.data()!.savedPaise as number);
    });
  }

  // Gold accounts with items tracked in nw_gold_items get a suggested value
  // = sum of (grams x today's rate for that item's karat) — same one-tap
  // suggestion mechanism as the Money links above, never auto-applied.
  const goldAccountIds = accounts.filter((a) => a.assetClass === "gold" && !a.archived).map((a) => a.id);
  const goldValueByAccount = new Map<string, number>();
  if (goldAccountIds.length > 0) {
    const [itemsSnap, rate] = await Promise.all([
      db().collection("nw_gold_items").where("accountId", "in", goldAccountIds.slice(0, 10)).get(),
      getGoldRate(),
    ]);
    for (const doc of itemsSnap.docs) {
      const item = doc.data() as NwGoldItem;
      const value = effectiveGoldItemValuePaise(item, rate);
      if (value !== null) goldValueByAccount.set(item.accountId, (goldValueByAccount.get(item.accountId) ?? 0) + value);
    }
  }

  return accounts
    .filter((a) => !a.archived)
    .map((account) => {
      const previousValuePaise = prevSnap?.values[account.id] ?? null;
      const currentValuePaise = thisSnap?.values[account.id] ?? previousValuePaise;
      const suggestedValuePaise = account.linkedToMoneyLeftover
        ? moneyLeftPaise
        : account.linkedToMoneyGoalId
          ? (goalSavedById.get(account.linkedToMoneyGoalId) ?? null)
          : goldValueByAccount.has(account.id)
            ? goldValueByAccount.get(account.id)!
            : null;
      return { account, previousValuePaise, currentValuePaise, suggestedValuePaise };
    });
}

/** Repair path: rebuilds totals from the stored values alone (e.g. after an account's assetClass changes retroactively). */
export async function recomputeSnapshot(monthKey: string): Promise<NwSnapshot> {
  const [snap, accounts] = await Promise.all([getSnapshot(monthKey), getAccounts()]);
  const existing = snap ?? emptySnapshot(monthKey);
  const next: NwSnapshot = { ...existing, totals: computeTotals(existing.values, accounts) };
  await db().collection("nw_snapshots").doc(monthKey).set(next);
  return next;
}
