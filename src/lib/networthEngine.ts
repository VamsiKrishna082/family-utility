import { db } from "@/lib/firestore";
import { effectiveGoldItemValuePaise, getGoldRate } from "@/lib/goldPrice";
import type { MoneyMonthSummary, NwAccount, NwAutoSource, NwGoldItem, NwSnapshot, NwUpdateRow } from "@/lib/types";

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

/** Who a snapshot value is attributed to when the app filled it in itself. */
export const AUTO_ENTERED_BY = "auto";

export type AutoValue = { valuePaise: number; source: NwAutoSource };

/**
 * Values the app fills in by itself — no manual entry:
 *  - linkedToMoneyLeftover: Money's leftPaise for this month (money_months/{monthKey}),
 *  - linkedToMoneyGoalId:   that Money goal's savedPaise,
 *  - gold accounts with tracked items: Σ grams × today's rate for each item's karat.
 * An account with no source value yet (e.g. no Money summary this month, or
 * no gold items) is simply absent, and stays a normal hand-entered row.
 * Money's month and Net Worth's month use the same literal "YYYY-MM" key; if
 * Money's monthStartDay isn't 1 the two months don't line up exactly.
 */
export async function computeAutoValues(accounts: NwAccount[], monthKey: string): Promise<Map<string, AutoValue>> {
  const live = accounts.filter((a) => !a.archived);
  const out = new Map<string, AutoValue>();

  const leftoverAccounts = live.filter((a) => a.linkedToMoneyLeftover);
  const goalAccounts = live.filter((a) => !a.linkedToMoneyLeftover && a.linkedToMoneyGoalId);
  const goldAccountIds = live.filter((a) => a.assetClass === "gold" && !a.linkedToMoneyLeftover && !a.linkedToMoneyGoalId).map((a) => a.id);

  const [moneyLeftPaise, goalSnaps, gold] = await Promise.all([
    leftoverAccounts.length
      ? db().collection("money_months").doc(monthKey).get().then((d) => (d.exists ? (d.data() as MoneyMonthSummary).leftPaise : null))
      : Promise.resolve(null),
    Promise.all([...new Set(goalAccounts.map((a) => a.linkedToMoneyGoalId!))].map((id) => db().collection("money_goals").doc(id).get())),
    goldAccountIds.length
      ? Promise.all([db().collection("nw_gold_items").where("accountId", "in", goldAccountIds.slice(0, 10)).get(), getGoldRate()])
      : Promise.resolve(null),
  ]);

  if (moneyLeftPaise !== null) for (const a of leftoverAccounts) out.set(a.id, { valuePaise: moneyLeftPaise, source: "money_leftover" });

  const goalSaved = new Map(goalSnaps.filter((g) => g.exists).map((g) => [g.id, g.data()!.savedPaise as number]));
  for (const a of goalAccounts) {
    const v = goalSaved.get(a.linkedToMoneyGoalId!);
    if (v !== undefined) out.set(a.id, { valuePaise: v, source: "money_goal" });
  }

  if (gold) {
    const [itemsSnap, rate] = gold;
    const byAccount = new Map<string, number>();
    for (const doc of itemsSnap.docs) {
      const item = doc.data() as NwGoldItem;
      const value = effectiveGoldItemValuePaise(item, rate);
      if (value !== null) byAccount.set(item.accountId, (byAccount.get(item.accountId) ?? 0) + value);
    }
    for (const [id, v] of byAccount) out.set(id, { valuePaise: v, source: "gold_items" });
  }
  return out;
}

/**
 * Writes the automatic values into the CURRENT month's snapshot — only the
 * ones that actually changed, so viewing Net Worth doesn't write on every
 * load. Past months are never touched: once a month is over, its last synced
 * values are its history. Returns the account ids that are automatic.
 */
export async function syncAutoValues(monthKey: string): Promise<Map<string, AutoValue>> {
  if (monthKey !== currentMonthKey()) return new Map();
  const [accounts, snap] = await Promise.all([getAccounts(), getSnapshot(monthKey)]);
  const auto = await computeAutoValues(accounts, monthKey);
  const changed: Record<string, number> = {};
  for (const [id, { valuePaise }] of auto) {
    if (snap?.values[id] !== valuePaise) changed[id] = valuePaise;
  }
  if (Object.keys(changed).length) await saveSnapshotValues(monthKey, changed, AUTO_ENTERED_BY);
  return auto;
}

/**
 * Rows for the update-balances form: previous month's value as a greyed
 * hint, and this month's value pre-filled from the previous month if this
 * month hasn't been saved yet — nothing is written by opening the form.
 * Automatic accounts come back with autoValuePaise set (current month only)
 * and are shown read-only.
 */
export async function getUpdateFormRows(monthKey: string): Promise<NwUpdateRow[]> {
  const [accounts, thisSnap, prevSnap] = await Promise.all([
    getAccounts(),
    getSnapshot(monthKey),
    getSnapshot(previousMonthKey(monthKey)),
  ]);
  const auto = monthKey === currentMonthKey() ? await computeAutoValues(accounts, monthKey) : new Map<string, AutoValue>();

  return accounts
    .filter((a) => !a.archived)
    .map((account) => {
      const previousValuePaise = prevSnap?.values[account.id] ?? null;
      const a = auto.get(account.id);
      const currentValuePaise = a ? a.valuePaise : thisSnap?.values[account.id] ?? previousValuePaise;
      return { account, previousValuePaise, currentValuePaise, autoValuePaise: a?.valuePaise ?? null, autoSource: a?.source ?? null };
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
