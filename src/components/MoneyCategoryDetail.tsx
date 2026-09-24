"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { formatPaise, formatPaiseExact } from "@/lib/money";
import type { MoneyCategoriesResponse, MoneyTx, MoneyTxListResponse } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

/**
 * Walks every page of the month's transactions. Filtering by category happens
 * here rather than via ?category= because month + category together would
 * need a composite index this project doesn't have; a single month is small
 * enough that pulling all of it is fine.
 */
const fetchAllTx = async (url: string): Promise<MoneyTx[]> => {
  const out: MoneyTx[] = [];
  let cursor: string | null = null;
  do {
    const page: MoneyTxListResponse = await fetcher(`${url}${cursor ? `&cursor=${cursor}` : ""}`);
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
};

/** Entries logged before sub-categories existed (or left blank) still count — they just sit in this bucket. */
const NO_SUB = "No sub-category";

function monthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/**
 * Category → sub-category totals → individual entries. E.g. Food ₹100 on the
 * dashboard opens here as "Elanir ₹100" (two ₹50 entries combined); tapping
 * Elanir lists both entries with their dates.
 */
export function MoneyCategoryDetail({ categoryId, month }: { categoryId: string; month: string | null }) {
  const { data: allTx, error, mutate, isLoading } = useSWR<MoneyTx[]>(`/api/money/tx?${month ? `month=${month}` : ""}`, fetchAllTx);
  const { data: catData } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const categories = catData?.items ?? [];
  const category = categories.find((c) => c.id === categoryId);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [editing, setEditing] = useState<MoneyTx | null>(null);

  const items = useMemo(() => (allTx ?? []).filter((tx) => tx.categoryId === categoryId), [allTx, categoryId]);
  const total = items.reduce((s, tx) => s + tx.amountPaise, 0);

  const bySub = useMemo(() => {
    const map = new Map<string, MoneyTx[]>();
    for (const tx of items) {
      const key = tx.subcategory?.trim() || NO_SUB;
      map.set(key, [...(map.get(key) ?? []), tx]);
    }
    return [...map.entries()]
      .map(([name, txs]) => ({ name, txs, totalPaise: txs.reduce((s, t) => s + t.amountPaise, 0) }))
      .sort((a, b) => b.totalPaise - a.totalPaise);
  }, [items]);
  const maxSub = bySub[0]?.totalPaise ?? 0;
  const openRow = openSub ? bySub.find((r) => r.name === openSub) : undefined;

  const remove = async (tx: MoneyTx) => {
    await mutate((allTx ?? []).filter((t) => t.id !== tx.id), false);
    await fetch(`/api/money/tx/${tx.id}`, { method: "DELETE" });
    mutate();
  };

  const barColor = category?.type === "saving" ? "var(--indigo)" : category?.type === "income" ? "var(--green)" : "var(--red)";

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        {openRow ? (
          <button onClick={() => setOpenSub(null)} aria-label="Back to sub-categories" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
            <ChevronLeft size={19} />
          </button>
        ) : (
          <Link href="/money" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
            <ChevronLeft size={19} />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <p style={{ color: "var(--faint)", fontSize: 13 }}>
            {openRow ? (
              <button onClick={() => setOpenSub(null)} style={{ color: "var(--indigo)", fontWeight: 600 }}>{category?.name ?? "Category"}</button>
            ) : (
              category?.group
            )}
            {" · "}{month ? monthKeyLabel(month) : "All months"}
          </p>
          <h1 className="display truncate" style={{ fontSize: 30 }}>{openRow ? openRow.name : (category?.name ?? "Category")}</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {openRow
              ? `${formatPaiseExact(openRow.totalPaise)} · ${openRow.txs.length} entr${openRow.txs.length === 1 ? "y" : "ies"}`
              : `${formatPaiseExact(total)} · ${items.length} entr${items.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>
      ) : isLoading && !allTx ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 14, padding: "24px 0", textAlign: "center" }}>Nothing in this category {month ? "this month" : "yet"}.</p>
      ) : !openRow ? (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>By sub-category</p>
          {bySub.map((row) => (
            <button key={row.name} onClick={() => setOpenSub(row.name)} className="block w-full text-left mb-3 last:mb-0">
              <div className="flex justify-between items-center" style={{ fontSize: 13.5, marginBottom: 4 }}>
                <span style={{ color: row.name === NO_SUB ? "var(--faint)" : "var(--ink)", fontStyle: row.name === NO_SUB ? "italic" : "normal" }}>
                  {row.name}
                  <span style={{ color: "var(--faint)", fontSize: 12, marginLeft: 6 }}>×{row.txs.length}</span>
                </span>
                <span className="flex items-center gap-1" style={{ color: "var(--dim)", fontWeight: 600 }}>
                  {formatPaiseExact(row.totalPaise)} <ChevronRight size={14} color="var(--faint)" />
                </span>
              </div>
              <div style={{ height: 6, background: "var(--line2)", borderRadius: 6 }}>
                <div style={{ height: 6, width: `${maxSub > 0 ? (row.totalPaise / maxSub) * 100 : 0}%`, background: barColor, borderRadius: 6 }} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {openRow.txs.map((tx, i) => (
            <div key={tx.id} className="group flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <span style={{ fontSize: 12.5, color: "var(--faint)", width: 78, flexShrink: 0 }}>
                {new Date(`${tx.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
              </span>
              <span className="truncate flex-1" style={{ fontSize: 13.5, color: "var(--dim)" }}>
                {[category?.name, tx.subcategory].filter(Boolean).join(" · ")}
                {tx.note && <span style={{ color: "var(--faint)" }}> — {tx.note}</span>}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{formatPaise(tx.amountPaise)}</span>
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
