"use client";

import { useState } from "react";
import useSWR from "swr";
import { Target, Plus } from "lucide-react";
import { formatPaise, parseRupeesToPaise } from "@/lib/money";
import type { MoneyCategory, MoneyGoalsResponse } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load goals");
  return r.json();
};

/** Gives "Move part to savings" something to actually work toward — a target with a progress bar, credited by any saving contribution tagged to it. */
export function MoneyGoals({ savingCategories, onContributed }: { savingCategories: MoneyCategory[]; onContributed: () => void }) {
  const { data, mutate } = useSWR<MoneyGoalsResponse>("/api/money/goals", fetcher);
  const [adding, setAdding] = useState(false);
  const [contributingTo, setContributingTo] = useState<string | null>(null);

  const goals = data?.items ?? [];

  return (
    <div className="card mt-8" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
          <Target size={15} color="var(--faint)" /> Goals
        </p>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ New goal"}
        </button>
      </div>

      {adding && <NewGoalForm onDone={() => { setAdding(false); mutate(); }} />}

      {goals.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>No goals yet — an emergency fund, a trip, a down payment.</p>
      ) : (
        goals.map((g, i) => {
          const pct = g.targetPaise > 0 ? Math.min((g.savedPaise / g.targetPaise) * 100, 100) : 0;
          return (
            <div key={g.id} className="mb-4 last:mb-0" style={{ paddingTop: i === 0 ? 0 : 12, borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <div className="flex justify-between" style={{ fontSize: 13.5, marginBottom: 4 }}>
                <span>{g.name}</span>
                <span style={{ color: "var(--faint)" }}>{formatPaise(g.savedPaise)} / {formatPaise(g.targetPaise)}</span>
              </div>
              <div style={{ height: 6, background: "var(--line2)", borderRadius: 6, marginBottom: 8 }}>
                <div style={{ height: 6, width: `${pct}%`, background: "var(--indigo)", borderRadius: 6, transition: "width .3s ease" }} />
              </div>
              {contributingTo === g.id ? (
                <ContributeForm
                  goalId={g.id}
                  categories={savingCategories}
                  onDone={() => { setContributingTo(null); mutate(); onContributed(); }}
                  onCancel={() => setContributingTo(null)}
                />
              ) : (
                <button
                  className="btn btn-plain"
                  style={{ padding: "5px 10px", fontSize: 12.5 }}
                  onClick={() => setContributingTo(g.id)}
                  disabled={savingCategories.length === 0}
                >
                  + Add
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function NewGoalForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const targetPaise = parseRupeesToPaise(target);
    if (!name.trim() || !targetPaise) return;
    setSaving(true);
    try {
      await fetch("/api/money/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), targetPaise }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-wrap items-center gap-2 mb-4" style={{ padding: 12, background: "var(--paper)" }}>
      <input
        type="text" placeholder="Goal, e.g. Emergency fund" value={name} onChange={(e) => setName(e.target.value)}
        style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      />
      <input
        type="number" inputMode="decimal" placeholder="₹ Target" value={target} onChange={(e) => setTarget(e.target.value)}
        style={{ width: 120, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      />
      <button className="btn btn-dark flex items-center gap-1" style={{ padding: "8px 12px", fontSize: 13 }} onClick={save} disabled={saving}>
        <Plus size={13} /> {saving ? "Adding…" : "Add"}
      </button>
    </div>
  );
}

function ContributeForm({
  goalId,
  categories,
  onDone,
  onCancel,
}: {
  goalId: string;
  categories: MoneyCategory[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise || !categoryId) return;
    setBusy(true);
    await fetch("/api/money/leftover/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaise, categoryId, goalId }),
    });
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number" inputMode="decimal" placeholder="₹ Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
        style={{ width: 110, borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 13 }}
      />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 13 }}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={onCancel}>Cancel</button>
      <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add"}</button>
    </div>
  );
}
