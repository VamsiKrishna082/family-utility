"use client";

import { useState } from "react";
import useSWR from "swr";
import { Repeat, Plus, Trash2 } from "lucide-react";
import { formatPaise, parseRupeesToPaise } from "@/lib/money";
import { MONEY_TX_TYPES, type MoneyCategory, type MoneyRecurringResponse, type MoneyTxType } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load recurring entries");
  return r.json();
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Templates for the household's repeating line items (rent, EMIs, SIPs,
 * subscriptions) so they're a single tap instead of a blank quick-add every
 * month. No auto-posting or scheduler yet — "Post" is always a deliberate,
 * manual trigger; it just skips retyping the amount and category.
 */
export function MoneyRecurring({ categories, onPosted }: { categories: MoneyCategory[]; onPosted: () => void }) {
  const { data, mutate } = useSWR<MoneyRecurringResponse>("/api/money/recurring", fetcher);
  const [posting, setPosting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const templates = (data?.items ?? []).filter((t) => t.active);
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));

  const post = async (id: string, categoryId: string, type: MoneyTxType, amountPaise: number, name: string) => {
    setPosting(id);
    try {
      await fetch("/api/money/tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sub-categories are required; a template's own name (Rent, SIP…) is the natural one.
        body: JSON.stringify({ type, amountPaise, categoryId, subcategory: name, date: todayISO(), note: name, recurringId: id }),
      });
      onPosted();
    } finally {
      setPosting(null);
    }
  };

  const remove = async (id: string) => {
    await mutate({ items: (data?.items ?? []).filter((t) => t.id !== id) }, false);
    await fetch(`/api/money/recurring/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div className="card mt-8" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
          <Repeat size={15} color="var(--faint)" /> Recurring
        </p>
        <button onClick={() => setAdding((v) => !v)} style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>
          {adding ? "Cancel" : "+ New template"}
        </button>
      </div>

      {adding && (
        <NewTemplateForm categories={categories} onDone={() => { setAdding(false); mutate(); }} />
      )}

      {templates.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>No recurring templates yet — rent, EMIs, SIPs, subscriptions.</p>
      ) : (
        templates.map((t, i) => (
          <div key={t.id} className="group flex items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
            <span className="truncate flex-1" style={{ fontSize: 14 }}>{t.name}</span>
            <span className="truncate" style={{ fontSize: 12.5, color: "var(--faint)" }}>{nameOf.get(t.categoryId) ?? "—"}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{formatPaise(t.amountPaise)}</span>
            <button
              className="btn btn-plain"
              style={{ padding: "5px 10px", fontSize: 12.5 }}
              onClick={() => post(t.id, t.categoryId, t.type, t.amountPaise, t.name)}
              disabled={posting === t.id}
            >
              {posting === t.id ? "Posting…" : "Post this month"}
            </button>
            <button
              onClick={() => remove(t.id)}
              aria-label="Delete template"
              className="opacity-0 group-hover:opacity-100"
              style={{ color: "var(--faint)", padding: 4, transition: "opacity .15s ease" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function NewTemplateForm({ categories, onDone }: { categories: MoneyCategory[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MoneyTxType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const forType = categories.filter((c) => c.type === type && !c.archived);

  const save = async () => {
    const amountPaise = parseRupeesToPaise(amount);
    if (!name.trim() || !amountPaise || !categoryId) return;
    setSaving(true);
    try {
      await fetch("/api/money/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, amountPaise, categoryId }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-wrap items-center gap-2 mb-4" style={{ padding: 12, background: "var(--paper)" }}>
      <input
        type="text" placeholder="Name, e.g. Rent" value={name} onChange={(e) => setName(e.target.value)}
        style={{ flex: 1, minWidth: 120, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      />
      <select
        value={type}
        onChange={(e) => { setType(e.target.value as MoneyTxType); setCategoryId(""); }}
        style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      >
        {MONEY_TX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
        <option value="">Category…</option>
        {forType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input
        type="number" inputMode="decimal" placeholder="₹ Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
        style={{ width: 110, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
      />
      <button className="btn btn-dark flex items-center gap-1" style={{ padding: "8px 12px", fontSize: 13 }} onClick={save} disabled={saving}>
        <Plus size={13} /> {saving ? "Adding…" : "Add"}
      </button>
    </div>
  );
}
