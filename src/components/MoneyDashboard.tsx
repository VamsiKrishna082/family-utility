"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, ChevronRight, Plus, PiggyBank } from "lucide-react";
import { formatPaise, formatPaiseExact, parseRupeesToPaise } from "@/lib/money";
import type { MoneyDashboardResponse, MoneyCategoriesResponse, MoneyGoalsResponse, MoneyTx } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";
import { MoneyRecurring } from "@/components/MoneyRecurring";
import { MoneyGoals } from "@/components/MoneyGoals";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load the dashboard");
  return r.json();
};

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  let year = y;
  let month = m + delta;
  while (month > 12) { month -= 12; year += 1; }
  while (month < 1) { month += 12; year -= 1; }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthKeyLabel(monthKey: string, style: "short" | "long" = "short"): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: style, year: "numeric" });
}

const typeColor: Record<MoneyTx["type"], string> = {
  income: "var(--green)", expense: "var(--red)", saving: "var(--indigo)", transfer: "var(--faint)",
};

/** Up is bad for an expense category (spending more) but good for a saving one (investing more) — opposite polarity, same arrow. */
function vsColor(type: "expense" | "saving", pct: number): string {
  const up = pct >= 0;
  if (type === "expense") return up ? "var(--red)" : "var(--green)";
  return up ? "var(--green)" : "var(--amber)";
}

export function MoneyDashboard() {
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const { data, error, mutate, isLoading } = useSWR<MoneyDashboardResponse>(
    `/api/money/dashboard${viewMonth ? `?month=${viewMonth}` : ""}`,
    fetcher,
  );
  const { data: catData, error: catError } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const displayMonth = viewMonth ?? data?.monthKey ?? null;
  const categories = catData?.items ?? [];
  const savingCategories = useMemo(() => categories.filter((c) => c.type === "saving" && !c.archived), [categories]);

  // Every category this month actually has expense OR saving/investment
  // activity in, named and totaled — e.g. four Food entries of
  // 400+100+200+... collapse into one "Food: ₹700" row. Saving rows (SIPs,
  // PPF, etc.) are included too since money.md counts investment as money
  // that left "left to spend" same as an expense does, just tagged so it
  // doesn't read as overspending. No budget involved, just what happened.
  const spentByCategory = useMemo(() => {
    if (!data) return [];
    const typeOf = new Map(categories.map((c) => [c.id, c.type]));
    const nameOf = new Map(categories.map((c) => [c.id, c.name]));
    return Object.entries(data.summary.byCategory)
      .filter(([id, paise]) => (typeOf.get(id) === "expense" || typeOf.get(id) === "saving") && paise > 0)
      .map(([id, paise]) => {
        const prevPaise = data.prevByCategory[id] ?? 0;
        const vsLastMonthPct = prevPaise > 0 ? Math.round(((paise - prevPaise) / prevPaise) * 100) : null;
        return { id, name: nameOf.get(id) ?? "—", spentPaise: paise, type: typeOf.get(id) as "expense" | "saving", vsLastMonthPct };
      })
      .sort((a, b) => b.spentPaise - a.spentPaise);
  }, [data, categories]);
  const maxSpent = spentByCategory[0]?.spentPaise ?? 0;

  if (error || catError) {
    return (
      <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>
        {(error ?? catError)?.message ?? "Something went wrong loading Money."}
      </div>
    );
  }
  if (!data && isLoading) {
    return <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>;
  }
  if (!data) return null;

  const { summary } = data;
  const savingsRate = summary.incomePaise > 0 ? Math.round((summary.savingPaise / summary.incomePaise) * 100) : 0;
  const spentPctOfBudget = (() => {
    const totalBudget = Object.values(data.budget.byGroup).reduce((s, v) => s + v, 0);
    return totalBudget > 0 ? Math.round((summary.expensePaise / totalBudget) * 100) : null;
  })();
  const vsLastMonth = data.prevMonthExpensePaise > 0
    ? Math.round(((summary.expensePaise - data.prevMonthExpensePaise) / data.prevMonthExpensePaise) * 100)
    : null;

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30 }}>Money</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>One pooled pot — no splitting, no settling up.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 card" style={{ padding: "6px 10px" }}>
            <button aria-label="Previous month" onClick={() => setViewMonth(shiftMonthKey(displayMonth!, -1))}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 92, textAlign: "center" }}>{displayMonth ? monthKeyLabel(displayMonth) : ""}</span>
            <button aria-label="Next month" onClick={() => setViewMonth(shiftMonthKey(displayMonth!, 1))}><ChevronRight size={16} /></button>
          </div>
          <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setQuickAddOpen(true)}>
            <Plus size={15} /> <span className="hidden sm:inline">Add entry</span>
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-8" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Carried over from {data.prevMonthLabel}</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6 }}>{formatPaise(summary.carryInPaise)}</p>
        </div>
        <Link href={`/money/transactions?month=${data.monthKey}&type=income`} className="card block" style={{ padding: 18 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Income</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--green)" }}>{formatPaise(summary.incomePaise)}</p>
        </Link>
        <Link href={`/money/transactions?month=${data.monthKey}&type=expense`} className="card block" style={{ padding: 18 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Spent</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--red)" }}>{formatPaise(summary.expensePaise)}</p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
            {spentPctOfBudget !== null && `${spentPctOfBudget}% of budget`}
            {spentPctOfBudget !== null && vsLastMonth !== null && " · "}
            {vsLastMonth !== null && `${vsLastMonth >= 0 ? "+" : ""}${vsLastMonth}% vs last month`}
          </p>
        </Link>
        <Link href={`/money/transactions?month=${data.monthKey}&type=saving`} className="card block" style={{ padding: 18 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Saved &amp; invested</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--indigo)" }}>{formatPaise(summary.savingPaise)}</p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>{savingsRate}% savings rate</p>
        </Link>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Left to spend</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: summary.leftPaise >= 0 ? "var(--ink)" : "var(--red)" }}>{formatPaise(summary.leftPaise)}</p>
          {data.safeToSpendPerDayPaise !== null && (
            <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>{formatPaise(data.safeToSpendPerDayPaise)}/day safe to spend</p>
          )}
        </div>
      </div>

      {/* Recent entries */}
      <div className="card mb-8" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 14, fontWeight: 600 }}>Recent entries</p>
          <Link href={`/money/transactions?month=${data.monthKey}`} style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>See all</Link>
        </div>
        {data.recent.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Nothing recorded this month yet.</p>
        ) : (
          data.recent.map((tx, i) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: typeColor[tx.type], flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--faint)", width: 38, flexShrink: 0 }}>{tx.date.slice(5)}</span>
              <span className="truncate" style={{ fontSize: 14, width: 140, flexShrink: 0 }}>{categories.find((c) => c.id === tx.categoryId)?.name ?? "—"}</span>
              <span className="truncate flex-1" style={{ fontSize: 13, color: "var(--dim)" }}>{tx.note}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: typeColor[tx.type], flexShrink: 0 }}>
                {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}{formatPaise(tx.amountPaise)}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        {/* Spent & invested by category */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Spent &amp; invested by category</p>
          {spentByCategory.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 14 }}>Nothing yet this month.</p>
          ) : (
            spentByCategory.map((row) => (
              <div key={row.id} className="mb-3 last:mb-0">
                <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 4 }}>
                  <span className="flex items-center gap-1.5">
                    {row.name}
                    {row.type === "saving" && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--indigo)", border: "1px solid var(--indigo)", borderRadius: 5, padding: "1px 5px" }}>
                        SAVING
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {row.vsLastMonthPct !== null && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: vsColor(row.type, row.vsLastMonthPct) }}>
                        {row.vsLastMonthPct >= 0 ? "▲" : "▼"}{Math.abs(row.vsLastMonthPct)}%
                      </span>
                    )}
                    <span style={{ color: "var(--faint)" }}>{formatPaiseExact(row.spentPaise)}</span>
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--line2)", borderRadius: 6 }}>
                  <div style={{ height: 6, width: `${maxSpent > 0 ? (row.spentPaise / maxSpent) * 100 : 0}%`, background: row.type === "saving" ? "var(--indigo)" : "var(--red)", borderRadius: 6, transition: "width .3s ease" }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Month-end leftover */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Month-end leftover</p>
          <p className="display" style={{ fontSize: 24 }}>{formatPaise(summary.leftPaise)}</p>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>Carries into {monthKeyLabel(shiftMonthKey(data.monthKey, 1))} if untouched.</p>

          {!moveOpen ? (
            <button
              className="btn btn-plain flex items-center gap-1.5 mt-4"
              style={{ fontSize: 13 }}
              onClick={() => setMoveOpen(true)}
              disabled={savingCategories.length === 0}
            >
              <PiggyBank size={14} /> Move part to savings
            </button>
          ) : (
            <MoveToSavingsForm categories={savingCategories} onDone={() => { setMoveOpen(false); mutate(); }} onCancel={() => setMoveOpen(false)} />
          )}
        </div>
      </div>

      {/* Biggest expenses */}
      {data.topExpenses.length > 0 && (
        <div className="card mt-8" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Biggest expenses this month</p>
          {data.topExpenses.map((tx, i) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <span
                className="flex items-center justify-center"
                style={{ width: 20, height: 20, borderRadius: 999, background: "var(--line2)", fontSize: 11, fontWeight: 700, color: "var(--faint)", flexShrink: 0 }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--faint)", width: 38, flexShrink: 0 }}>{tx.date.slice(5)}</span>
              <span className="truncate" style={{ fontSize: 14, width: 140, flexShrink: 0 }}>{categories.find((c) => c.id === tx.categoryId)?.name ?? "—"}</span>
              <span className="truncate flex-1" style={{ fontSize: 13, color: "var(--dim)" }}>{tx.note}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--red)", flexShrink: 0 }}>{formatPaise(tx.amountPaise)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <MoneyRecurring categories={categories} onPosted={() => mutate()} />
        <MoneyGoals savingCategories={savingCategories} onContributed={() => mutate()} />
      </div>

      {quickAddOpen && (
        <MoneyQuickAdd categories={categories} onClose={() => setQuickAddOpen(false)} onSaved={() => mutate()} />
      )}
    </div>
  );
}

function MoveToSavingsForm({
  categories,
  onDone,
  onCancel,
}: {
  categories: { id: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [goalId, setGoalId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: goalsData } = useSWR<MoneyGoalsResponse>("/api/money/goals", fetcher);
  const goals = goalsData?.items ?? [];
  const { mutate: globalMutate } = useSWRConfig();

  const submit = async () => {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise || !categoryId) return;
    setBusy(true);
    await fetch("/api/money/leftover/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaise, categoryId, goalId: goalId || undefined }),
    });
    setBusy(false);
    // Goals card owns its own "/api/money/goals" fetch (separate from the
    // dashboard's own SWR key) — revalidate it directly so a contribution
    // made from here shows up there without waiting for a natural refetch.
    if (goalId) globalMutate("/api/money/goals");
    onDone();
  };

  return (
    <div className="mt-4" style={{ display: "grid", gap: 8 }}>
      <input
        type="number" inputMode="decimal" placeholder="₹ Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
        style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {goals.length > 0 && (
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
          <option value="">No goal — just a saving entry</option>
          {goals.map((g) => <option key={g.id} value={g.id}>Toward: {g.name}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <button className="btn btn-plain flex-1" style={{ fontSize: 13, padding: "7px 10px" }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-dark flex-1" style={{ fontSize: 13, padding: "7px 10px" }} onClick={submit} disabled={busy}>{busy ? "Moving…" : "Move"}</button>
      </div>
    </div>
  );
}
