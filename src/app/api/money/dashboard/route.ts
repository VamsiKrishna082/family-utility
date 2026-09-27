import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { computeMonthKey, getSettings, previousMonthKey } from "@/lib/moneyEngine";
import { monthInsights, sameDayLastCycle } from "@/lib/moneyInsights";
import type { MoneyBudget, MoneyCategory, MoneyMonthSummary, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // en-CA -> YYYY-MM-DD
}

function monthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

const toUTCms = (dateISO: string) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Last calendar day of a cycle: the whole month if monthStartDay is 1, else (monthStartDay - 1) of the following calendar month. */
function cycleEndDate(monthKey: string, monthStartDay: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (monthStartDay <= 1) {
    const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
    return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  let endYear = y;
  let endMonth = m + 1;
  if (endMonth > 12) {
    endMonth = 1;
    endYear += 1;
  }
  return `${endYear}-${String(endMonth).padStart(2, "0")}-${String(monthStartDay - 1).padStart(2, "0")}`;
}

/**
 * GET /api/money/dashboard?month=YYYY-MM — everything the screen needs in one
 * response: the month's summary (or a computed-not-persisted stand-in if this
 * month has no transactions yet), its budget doc (empty if none set — phase 4
 * adds the UI to set one), and the last 7 transactions.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const settings = await getSettings();
    const today = todayInIndia();
    const currentMonthKey = computeMonthKey(today, settings.monthStartDay);
    const url = new URL(req.url);
    const monthKey = url.searchParams.get("month") ?? currentMonthKey;
    const prevKey = previousMonthKey(monthKey);

    const [summarySnap, prevSnap, budgetSnap, recentSnap, topExpensesSnap] = await Promise.all([
      db().collection("money_months").doc(monthKey).get(),
      db().collection("money_months").doc(prevKey).get(),
      db().collection("money_budgets").doc(monthKey).get(),
      db().collection("money_tx").where("monthKey", "==", monthKey).orderBy("date", "desc").orderBy("createdAt", "desc").limit(7).get(),
      // Ordered by amount, not date — fetches a few extra over the top-5 we
      // actually show since transfers/savings could rank above some
      // expenses and get filtered out below, without needing a second
      // composite index that also filters on type.
      db().collection("money_tx").where("monthKey", "==", monthKey).orderBy("amountPaise", "desc").limit(15).get(),
    ]);

    let summary: MoneyMonthSummary;
    if (summarySnap.exists) {
      summary = summarySnap.data() as MoneyMonthSummary;
    } else {
      const carryIn = prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary).leftPaise : settings.openingBalancePaise;
      summary = {
        monthKey, incomePaise: 0, expensePaise: 0, savingPaise: 0, surplusPaise: 0,
        carryInPaise: carryIn, leftPaise: carryIn, byGroup: {}, byCategory: {}, byMode: {}, txCount: 0, updatedAt: 0,
      };
    }

    const budget: MoneyBudget = budgetSnap.exists ? (budgetSnap.data() as MoneyBudget) : { monthKey, byGroup: {} };
    const recent = recentSnap.docs.map((d) => d.data() as MoneyTx);
    const topExpenses = topExpensesSnap.docs
      .map((d) => d.data() as MoneyTx)
      .filter((tx) => tx.type === "expense")
      .slice(0, 5);

    // "Safe to spend per day" only means something for the month you're actually in.
    let safeToSpendPerDayPaise: number | null = null;
    if (monthKey === currentMonthKey) {
      const end = cycleEndDate(monthKey, settings.monthStartDay);
      const daysRemaining = Math.max(1, Math.round((toUTCms(end) - toUTCms(today)) / 86_400_000) + 1);
      safeToSpendPerDayPaise = summary.leftPaise > 0 ? Math.floor(summary.leftPaise / daysRemaining) : 0;
    }

    // "In a few lines": this month vs the last — same-point-in-cycle for the month you're in.
    const catSnap = await db().collection("money_categories").get();
    const expenseCats = Object.fromEntries(catSnap.docs.map((d) => d.data() as MoneyCategory).filter((c) => c.type === "expense").map((c) => [c.id, c.name]));
    const prevSummary = prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary) : null;
    let prevForCompare = { expensePaise: prevSummary?.expensePaise ?? 0, byCategory: prevSummary?.byCategory ?? {} };
    if (monthKey === currentMonthKey && prevSummary) {
      const cycleStart = (mk: string) => `${mk}-${String(Math.max(1, settings.monthStartDay)).padStart(2, "0")}`;
      const cutoff = sameDayLastCycle(today, cycleStart(monthKey), cycleStart(prevKey), cycleEndDate(prevKey, settings.monthStartDay));
      const prevTx = await db().collection("money_tx").where("monthKey", "==", prevKey).get();
      const byCategory: Record<string, number> = {};
      let expensePaise = 0;
      for (const d of prevTx.docs) {
        const tx = d.data() as MoneyTx;
        if (tx.date > cutoff || (tx.type !== "expense" && tx.type !== "saving")) continue;
        byCategory[tx.categoryId] = (byCategory[tx.categoryId] ?? 0) + tx.amountPaise;
        if (tx.type === "expense") expensePaise += tx.amountPaise;
      }
      prevForCompare = { expensePaise, byCategory };
    }
    const insights = monthInsights({
      isCurrent: monthKey === currentMonthKey,
      prevLabel: monthKeyLabel(prevKey),
      cur: { expensePaise: summary.expensePaise, byCategory: summary.byCategory, incomePaise: summary.incomePaise, savingPaise: summary.savingPaise },
      prev: prevForCompare,
      expenseCats,
    });

    return ok({
      monthKey,
      insights,
      // For the headline "vs last month": the same point in last month's cycle when this is the current month.
      compareExpensePaise: prevForCompare.expensePaise,
      compareByCategory: prevForCompare.byCategory,
      isCurrentMonth: monthKey === currentMonthKey,
      prevMonthKey: prevKey,
      prevMonthLabel: monthKeyLabel(prevKey),
      prevMonthExpensePaise: prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary).expensePaise : 0,
      prevByCategory: prevSnap.exists ? (prevSnap.data() as MoneyMonthSummary).byCategory : {},
      summary,
      budget,
      recent,
      topExpenses,
      safeToSpendPerDayPaise,
    });
  } catch (e) {
    return fail(e);
  }
}
