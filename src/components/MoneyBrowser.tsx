"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { formatINR } from "@/lib/money";
import { MONEY_EXPENSE_CATEGORIES, MONEY_INCOME_CATEGORIES, type MoneyEntry } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const todayISO = () => new Date().toISOString().slice(0, 10);

function monthLabel(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function MoneyBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: MoneyEntry[] }>("/api/money", fetcher);
  const entries = data?.items ?? [];

  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(MONEY_EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const categories = kind === "expense" ? MONEY_EXPENSE_CATEGORIES : MONEY_INCOME_CATEGORIES;

  const { balance, thisMonthIn, thisMonthOut } = useMemo(() => {
    const nowMonth = new Date().toISOString().slice(0, 7);
    let balance = 0, thisMonthIn = 0, thisMonthOut = 0;
    for (const e of entries) {
      const signed = e.kind === "income" ? e.amount : -e.amount;
      balance += signed;
      if (e.date.slice(0, 7) === nowMonth) {
        if (e.kind === "income") thisMonthIn += e.amount;
        else thisMonthOut += e.amount;
      }
    }
    return { balance, thisMonthIn, thisMonthOut };
  }, [entries]);

  const grouped = useMemo(() => {
    const groups = new Map<string, MoneyEntry[]>();
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const key = e.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return [...groups.entries()];
  }, [entries]);

  const addEntry = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    await fetch("/api/money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, amount: amt, category, note, date }),
    });
    setAmount("");
    setNote("");
    setSaving(false);
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: entries.filter((e) => e.id !== id) }, false);
    await fetch(`/api/money/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Money</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>One pooled pot — no splitting, no settling up.</p>

      <div className="mt-7" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--faint)", fontSize: 13 }}>Balance</p>
          <p className="display" style={{ fontSize: 28, marginTop: 6, color: balance >= 0 ? "var(--green)" : "var(--red)" }}>
            {formatINR(balance)}
          </p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--faint)", fontSize: 13 }}>In this month</p>
          <p className="display flex items-center gap-2" style={{ fontSize: 22, marginTop: 6, color: "var(--green)" }}>
            <TrendingUp size={18} /> {formatINR(thisMonthIn)}
          </p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--faint)", fontSize: 13 }}>Out this month</p>
          <p className="display flex items-center gap-2" style={{ fontSize: 22, marginTop: 6, color: "var(--red)" }}>
            <TrendingDown size={18} /> {formatINR(thisMonthOut)}
          </p>
        </div>
      </div>

      <div className="card mt-8" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add an entry</p>
        <div className="flex flex-wrap gap-2">
          <div className="flex" style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden" }}>
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setCategory(k === "expense" ? MONEY_EXPENSE_CATEGORIES[0] : MONEY_INCOME_CATEGORIES[0]);
                }}
                style={{
                  padding: "9px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: kind === k ? "var(--ink)" : "var(--card)",
                  color: kind === k ? "#fff" : "var(--dim)",
                }}
              >
                {k === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <input
            type="number"
            inputMode="decimal"
            placeholder="₹ Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 130, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1"
            style={{ minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />

          <button className="btn btn-dark flex items-center gap-1.5" onClick={addEntry} disabled={saving}>
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : grouped.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No entries yet.</p>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} className="mb-6">
              <p style={{ color: "var(--faint)", fontSize: 12.5, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {monthLabel(items[0].date)}
              </p>
              <div className="card" style={{ overflow: "hidden" }}>
                {items.map((e, i) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-3 group"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}
                  >
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: 8, flexShrink: 0,
                        background: e.kind === "income" ? "var(--green)" : "var(--red)",
                      }}
                    />
                    <span style={{ fontSize: 14, flexShrink: 0, color: "var(--faint)", width: 78 }}>
                      {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <span style={{ fontSize: 14, flexShrink: 0, width: 110 }}>{e.category}</span>
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, color: "var(--dim)" }}>{e.note}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: e.kind === "income" ? "var(--green)" : "var(--red)" }}>
                      {e.kind === "income" ? "+" : "−"}{formatINR(e.amount)}
                    </span>
                    <button onClick={() => remove(e.id)} style={{ color: "var(--faint)" }} aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
