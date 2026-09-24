import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { computeTotals, currentMonthKey, getAccounts, previousMonthKey, shiftMonthKey, syncAutoValues } from "@/lib/networthEngine";
import type { NwAccount, NwAccountRow, NwSettings, NwSnapshot, NwTrendPoint } from "@/lib/types";

export const runtime = "nodejs";

const emptySnapshot = (monthKey: string): NwSnapshot => ({
  monthKey, values: {}, enteredBy: {}, updatedAt: 0,
  totals: { assetsPaise: 0, liabilitiesPaise: 0, netPaise: 0, byAssetClass: {} },
});

/**
 * GET /api/networth?month=YYYY-MM — accounts, this month's snapshot (or a
 * computed-not-persisted stand-in if nothing's been saved yet — same pattern
 * Money's dashboard uses), the previous month's (for the MoM change), the
 * trailing 12 months (trend — 12 reads, which the spec itself says is fine),
 * and emergency cover, which reads Money's own monthly summaries directly
 * rather than recomputing spending here.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const cur = currentMonthKey();
    const monthKey = url.searchParams.get("month") ?? cur;
    const prevKey = previousMonthKey(monthKey);

    // Automatic accounts (Money leftover, a Money goal, gold items × today's
    // rate) are written into the current month's snapshot before it's read,
    // so the page, the totals and the saved history all agree — no manual step.
    await syncAutoValues(monthKey);

    const trendKeys: string[] = [];
    for (let i = 11; i >= 0; i--) trendKeys.push(shiftMonthKey(monthKey, -i));

    const [accounts, thisSnap, prevSnap, trendSnaps, moneyMonths, settingsSnap] = await Promise.all([
      getAccounts(),
      db().collection("nw_snapshots").doc(monthKey).get(),
      db().collection("nw_snapshots").doc(prevKey).get(),
      Promise.all(trendKeys.map((k) => db().collection("nw_snapshots").doc(k).get())),
      Promise.all([1, 2, 3].map((i) => db().collection("money_months").doc(shiftMonthKey(monthKey, -i + 1)).get())),
      db().collection("nw_settings").doc("main").get(),
    ]);

    const prevSnapshot = prevSnap.exists ? (prevSnap.data() as NwSnapshot) : null;

    const trend: NwTrendPoint[] = trendSnaps.map((snap, i) => {
      const s = snap.exists ? (snap.data() as NwSnapshot) : null;
      return { monthKey: trendKeys[i], netPaise: s?.totals.netPaise ?? 0, liabilitiesPaise: s?.totals.liabilitiesPaise ?? 0, hasData: snap.exists };
    });

    // Per-account display value: walk backward through the already-fetched
    // trend window (newest to oldest) to find the most recent real entry —
    // reuses those 12 reads instead of issuing new ones. If it's not from
    // the viewed month, the UI shows it amber (spec: "values older than the
    // current snapshot are amber") rather than silently passing off a stale
    // number as current.
    const trendValuesByMonth = trendSnaps.map((snap) => (snap.exists ? (snap.data() as NwSnapshot).values : {}));
    const thisValues = thisSnap.exists ? (thisSnap.data() as NwSnapshot).values : {};
    const prevValues = prevSnap.exists ? (prevSnap.data() as NwSnapshot).values : {};

    const accountRows: NwAccountRow[] = accounts
      .filter((a) => !a.archived)
      .map((account) => {
        let valuePaise: number | null = null;
        let valueMonthKey: string | null = null;
        for (let i = trendKeys.length - 1; i >= 0; i--) {
          const v = trendValuesByMonth[i][account.id];
          if (v !== undefined) {
            valuePaise = v;
            valueMonthKey = trendKeys[i];
            break;
          }
        }
        const thisVal = thisValues[account.id];
        const prevVal = prevValues[account.id];

        return {
          account,
          valuePaise,
          valueMonthKey,
          isStale: valueMonthKey !== null && valueMonthKey !== monthKey,
          changeThisMonthPaise: thisVal !== undefined && prevVal !== undefined ? thisVal - prevVal : null,
        };
      });

    // The viewed month's display totals: each account's own this-month value
    // if it's been entered, else its most recent carried-forward value (same
    // number accountRows already shows, amber, in the table below) — so a
    // month with nothing entered yet reads as "unchanged from last update",
    // not a false drop to zero. computeTotals still only sums real numbers,
    // it's just fed a carried-forward values map instead of an empty one.
    const carriedValues = Object.fromEntries(
      accountRows.filter((r) => r.valuePaise !== null).map((r) => [r.account.id, r.valuePaise as number]),
    );
    const snapshot: NwSnapshot = {
      ...(thisSnap.exists ? (thisSnap.data() as NwSnapshot) : emptySnapshot(monthKey)),
      totals: computeTotals(carriedValues, accounts),
    };

    const liquidAssetsPaise = Object.entries(carriedValues).reduce((sum, [accountId, paise]) => {
      const account = accounts.find((a: NwAccount) => a.id === accountId);
      return account && !account.archived && account.kind !== "loan" && account.liquid ? sum + paise : sum;
    }, 0);
    const monthlySpends = moneyMonths.map((d) => (d.exists ? (d.data()!.expensePaise as number) : null)).filter((v): v is number => v !== null);
    const avgMonthlySpend = monthlySpends.length > 0 ? monthlySpends.reduce((s, v) => s + v, 0) / monthlySpends.length : 0;
    const emergencyCoverMonths = avgMonthlySpend > 0 ? liquidAssetsPaise / avgMonthlySpend : null;
    // moneyMonths[0] is shiftMonthKey(monthKey, 0) — this same month's own Money summary, already fetched above for the average.
    const savedThisMonthPaise = moneyMonths[0].exists ? (moneyMonths[0].data()!.savingPaise as number) : null;

    const settings: NwSettings = settingsSnap.exists ? (settingsSnap.data() as NwSettings) : { reminderDay: 1 };

    const pendingAccounts = accountRows.filter((r) => r.valueMonthKey !== monthKey).map((r) => r.account);

    return ok({
      monthKey,
      isCurrentMonth: monthKey === cur,
      accounts,
      snapshot,
      prevSnapshot,
      trend,
      accountRows,
      settings,
      emergencyCoverMonths,
      savedThisMonthPaise,
      pendingAccounts,
    });
  } catch (e) {
    return fail(e);
  }
}
