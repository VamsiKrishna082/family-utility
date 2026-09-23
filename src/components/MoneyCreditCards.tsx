"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, CreditCard, Plus, Archive, Pencil } from "lucide-react";
import { formatPaiseExact } from "@/lib/money";
import type { MoneyCategoriesResponse, MoneyCreditCardsResponse } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

const KEY = "/api/money/cards/summary";

export function MoneyCreditCards() {
  const { data, error, isLoading } = useSWR<MoneyCreditCardsResponse>(KEY, fetcher);
  const { data: catData } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const { mutate } = useSWRConfig();
  const [addingCard, setAddingCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [loggingForCardId, setLoggingForCardId] = useState<string | undefined>(undefined);

  const addCard = async () => {
    const name = newCardName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await fetch("/api/money/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      await mutate(KEY);
      setNewCardName("");
      setAddingCard(false);
    } finally {
      setSaving(false);
    }
  };

  const archiveCard = async (id: string, name: string) => {
    if (!window.confirm(`Archive "${name}"? Its spending history stays intact, it just stops showing up for new entries.`)) return;
    await fetch(`/api/money/cards/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) });
    await mutate(KEY);
  };

  const renameCard = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    await fetch(`/api/money/cards/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    await mutate(KEY);
    setRenamingId(null);
  };

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/money" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30 }}>Credit cards</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>What you've swiped vs. what you've paid off, per card</p>
        </div>
      </div>

      {error && <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>}
      {isLoading && !data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}

      {data && (
        <>
          <div className="card mb-6" style={{ padding: 20, background: "var(--ink)", color: "#fff" }}>
            <p className="flex items-center gap-2" style={{ color: "rgba(255,255,255,.6)", fontSize: 12.5 }}>
              <CreditCard size={13} /> Total bill to be paid
            </p>
            <p className="display" style={{ fontSize: 26, marginTop: 6 }}>{formatPaiseExact(data.totalOutstandingPaise)}</p>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)", marginTop: 4 }}>across {data.cards.length} card{data.cards.length === 1 ? "" : "s"} — swipes recorded but not yet paid off</p>
          </div>

          <button
            onClick={() => { setLoggingForCardId(undefined); setQuickAddOpen(true); }}
            className="btn btn-dark flex items-center justify-center gap-1.5 mb-6"
            style={{ width: "100%", padding: "12px" }}
          >
            <Plus size={15} /> Log a credit card expense
          </button>

          {data.cards.length === 0 && !addingCard && (
            <div className="card mb-6" style={{ padding: 20, color: "var(--faint)", fontSize: 14 }}>
              No cards yet — add one here, or straight from Add Entry when you log a credit card spend.
            </div>
          )}

          {data.cards.map(({ card, outstandingPaise, spentThisMonthPaise, spentPaise, paidPaise }) => (
            <div key={card.id} className="card mb-4" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-1">
                {renamingId === card.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && renameCard(card.id)}
                      style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "4px 8px", fontSize: 14, flex: 1 }}
                    />
                    <button className="btn btn-dark" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => renameCard(card.id)}>Save</button>
                    <button style={{ fontSize: 12, color: "var(--faint)" }} onClick={() => setRenamingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
                    {card.name}{card.last4 ? ` •••• ${card.last4}` : ""}
                  </p>
                )}
                {renamingId !== card.id && (
                  <div className="flex items-center gap-1">
                    <button aria-label="Rename" onClick={() => { setRenamingId(card.id); setRenameValue(card.name); }} style={{ color: "var(--faint)", padding: 4 }}>
                      <Pencil size={13} />
                    </button>
                    <button aria-label="Archive" onClick={() => archiveCard(card.id, card.name)} style={{ color: "var(--faint)", padding: 4 }}>
                      <Archive size={13} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-end gap-8 mt-2">
                <div>
                  <p style={{ fontSize: 11.5, color: "var(--faint)" }}>Bill to be paid</p>
                  <p className="display" style={{ fontSize: 20, color: outstandingPaise > 0 ? "var(--red)" : "var(--green)" }}>{formatPaiseExact(outstandingPaise)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11.5, color: "var(--faint)" }}>Spent this month</p>
                  <p className="display" style={{ fontSize: 16 }}>{formatPaiseExact(spentThisMonthPaise)}</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
                {formatPaiseExact(spentPaise)} swiped all-time · {formatPaiseExact(paidPaise)} paid off
              </p>
              <button
                onClick={() => { setLoggingForCardId(card.id); setQuickAddOpen(true); }}
                className="flex items-center gap-1.5"
                style={{ fontSize: 12.5, color: "var(--indigo)", marginTop: 10 }}
              >
                <Plus size={13} /> Log expense on this card
              </button>
            </div>
          ))}

          {addingCard ? (
            <div className="card flex gap-2" style={{ padding: 16 }}>
              <input
                autoFocus type="text" placeholder="Card name, e.g. HDFC Regalia"
                value={newCardName} onChange={(e) => setNewCardName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCard()}
                className="flex-1" style={{ border: "none", outline: "none", fontSize: 14, background: "transparent" }}
              />
              <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setAddingCard(false)}>Cancel</button>
              <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={addCard} disabled={!newCardName.trim() || saving}>
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          ) : (
            <button onClick={() => setAddingCard(true)} className="flex items-center gap-1.5" style={{ fontSize: 13, color: "var(--indigo)", padding: "6px 0" }}>
              <Plus size={14} /> Add a card
            </button>
          )}
        </>
      )}

      {quickAddOpen && (
        <MoneyQuickAdd
          categories={catData?.items ?? []}
          initialCreditCard
          initialCardId={loggingForCardId}
          onClose={() => setQuickAddOpen(false)}
          onSaved={() => mutate(KEY)}
        />
      )}
    </div>
  );
}
