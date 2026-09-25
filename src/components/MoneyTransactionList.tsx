"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Pencil, Trash2, Search, Tag, X } from "lucide-react";
import { formatPaise } from "@/lib/money";
import { MONEY_TX_TYPES, type MoneyCategoriesResponse, type MoneyTx, type MoneyTxListResponse, type MoneyTxType } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";
import type { TripsResponse } from "@/lib/trips/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load transactions");
  return r.json();
};

const typeColor: Record<MoneyTx["type"], string> = {
  income: "var(--green)", expense: "var(--red)", saving: "var(--indigo)", transfer: "var(--faint)",
};

function monthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function MoneyTransactionList({ initialMonth, initialType }: { initialMonth: string | null; initialType: MoneyTxType | null }) {
  const [month, setMonth] = useState(initialMonth);
  const [type, setType] = useState<MoneyTxType | "">(initialType ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MoneyTx | null>(null);

  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (type) params.set("type", type);
  if (categoryId) params.set("category", categoryId);
  if (tag.trim()) params.set("tag", tag.trim());
  if (q.trim().length >= 2) params.set("q", q.trim());

  const { data, mutate, isLoading } = useSWR<MoneyTxListResponse>(`/api/money/tx?${params}`, fetcher);
  const { data: catData } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const { data: tripsData } = useSWR<TripsResponse>("/api/trips", fetcher);
  const tripName = useMemo(() => new Map((tripsData?.items ?? []).map((t) => [t.id, t.name])), [tripsData]);
  const categories = catData?.items ?? [];
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const items = data?.items ?? [];
  const total = items.reduce((s, tx) => s + tx.amountPaise, 0);

  const remove = async (tx: MoneyTx) => {
    await mutate({ items: items.filter((t) => t.id !== tx.id), nextCursor: data?.nextCursor ?? null }, false);
    await fetch(`/api/money/tx/${tx.id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/money" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30 }}>Transactions</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {month ? monthKeyLabel(month) : "All months"} · {items.length} shown · {formatPaise(total)} total
          </p>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 mb-6" style={{ padding: 12 }}>
        <button
          className="btn btn-plain"
          style={{ padding: "8px 12px", fontSize: 13, background: month ? "var(--card)" : "var(--ink)", color: month ? "var(--ink)" : "#fff" }}
          onClick={() => setMonth(month ? null : (initialMonth ?? new Date().toISOString().slice(0, 7)))}
        >
          {month ? monthKeyLabel(month) : "All months"}
        </button>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MoneyTxType | "")}
          style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
        >
          <option value="">All types</option>
          {MONEY_TX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.group} · {c.name}</option>)}
        </select>
        {tag ? (
          <button
            className="flex items-center gap-1.5"
            onClick={() => setTag("")}
            style={{ padding: "7px 10px", borderRadius: 10, background: "var(--indigo)", color: "#fff", fontSize: 13 }}
          >
            <Tag size={12} /> {tag} <X size={12} />
          </button>
        ) : (
          <div className="flex items-center gap-2 card" style={{ padding: "6px 10px", width: 140 }}>
            <Tag size={13} color="var(--faint)" />
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="Tag, e.g. goa-trip"
              className="flex-1 outline-none" style={{ fontSize: 13, background: "transparent" }}
            />
          </div>
        )}
        <div className="flex items-center gap-2 card flex-1" style={{ padding: "6px 10px", minWidth: 160 }}>
          <Search size={14} color="var(--faint)" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes & sub-categories"
            className="flex-1 outline-none" style={{ fontSize: 13.5, background: "transparent" }}
          />
        </div>
      </div>

      {isLoading && !data ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 14, padding: "24px 0", textAlign: "center" }}>No transactions match.</p>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {items.map((tx, i) => (
            <div key={tx.id} className="group flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: typeColor[tx.type], flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--faint)", width: 44, flexShrink: 0 }}>{tx.date.slice(5)}</span>
              <span className="truncate" style={{ fontSize: 14, width: 150, flexShrink: 0 }}>{[categoryName.get(tx.categoryId) ?? "—", tx.subcategory].filter(Boolean).join(" · ")}
                {tx.tripId && tripName.get(tx.tripId) && (
                  <Link href={`/trips/${tx.tripId}`} className="block truncate" style={{ fontSize: 11.5, color: "var(--indigo)", fontWeight: 600 }}>✈ {tripName.get(tx.tripId)}</Link>
                )}
              </span>
              <span className="truncate flex-1" style={{ fontSize: 13.5, color: "var(--dim)" }}>{tx.note}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: typeColor[tx.type], flexShrink: 0 }}>
                {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}{formatPaise(tx.amountPaise)}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100" style={{ transition: "opacity .15s ease" }}>
                <button onClick={() => setEditing(tx)} aria-label="Edit" style={{ color: "var(--faint)", padding: 4 }}><Pencil size={14} /></button>
                <button onClick={() => remove(tx)} aria-label="Delete" style={{ color: "var(--faint)", padding: 4 }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MoneyQuickAdd editing={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => mutate()} />
      )}
    </div>
  );
}
