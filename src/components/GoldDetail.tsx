"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, Plus, Trash2, RefreshCw, Pencil, Coins } from "lucide-react";
import { formatPaiseExact, parseRupeesToPaise } from "@/lib/money";
import type { NwGoldItem, NwGoldPageResponse, NwHeldBy } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

function heldByLabel(heldBy: NwHeldBy): string {
  return heldBy === "joint" ? "Joint" : heldBy === "yours" ? "Vamsi" : "Varshini";
}

function karatRatePaise(rate: NwGoldPageResponse["rate"], karat: 24 | 22 | 18): number {
  if (!rate) return 0;
  return karat === 24 ? rate.per24kGramPaise : karat === 22 ? rate.per22kGramPaise : rate.per18kGramPaise;
}

/** A manual value override always wins; otherwise grams x today's rate; null if there's no rate yet and no override. */
function effectiveValuePaise(item: Pick<NwGoldItem, "karat" | "grams" | "manualValuePaise">, rate: NwGoldPageResponse["rate"]): number | null {
  if (item.manualValuePaise !== undefined) return item.manualValuePaise;
  if (!rate) return null;
  return Math.round(item.grams * karatRatePaise(rate, item.karat));
}

function rateSourceLabel(source: NonNullable<NwGoldPageResponse["rate"]>["source"]): string {
  if (source === "manual") return "Set by hand";
  if (source === "chennai") return "Live · Chennai";
  return "Live · international spot";
}

const KEY = "/api/networth/gold";

export function GoldDetail() {
  const { data, error, isLoading } = useSWR<NwGoldPageResponse>(KEY, fetcher);
  const { mutate } = useSWRConfig();
  const [editingRate, setEditingRate] = useState(false);
  const [rateDraft, setRateDraft] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const saveManualRate = async () => {
    const paise = parseRupeesToPaise(rateDraft);
    if (paise === null || paise <= 0) return;
    setSavingRate(true);
    try {
      await fetch("/api/networth/gold/rate", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ per24kGramPaise: paise }) });
      await mutate(KEY);
      setEditingRate(false);
    } finally {
      setSavingRate(false);
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await fetch(`/api/networth/gold/items/${id}`, { method: "DELETE" });
    await mutate(KEY);
  };

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/worth" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30 }}>Gold</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Every piece you own, tracked separately by grams and karat</p>
        </div>
      </div>

      {error && <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>}
      {isLoading && !data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}

      {data && (
        <>
          {/* Today's rate */}
          <div className="card mb-6" style={{ padding: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: editingRate ? 14 : 0 }}>
              <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
                <Coins size={15} color="var(--faint)" /> Today&apos;s rate
              </p>
              {!editingRate && (
                <button
                  onClick={() => { setRateDraft(data.rate ? String(data.rate.per24kGramPaise / 100) : ""); setEditingRate(true); }}
                  className="flex items-center gap-1"
                  style={{ fontSize: 12, color: "var(--faint)" }}
                >
                  <Pencil size={12} /> Override
                </button>
              )}
            </div>

            {editingRate ? (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 4 }}>
                <span style={{ fontSize: 13, color: "var(--dim)" }}>24k, per gram</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="₹0"
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                  style={{ width: 110, borderRadius: 10, border: "1px solid var(--line)", padding: "6px 10px", fontSize: 14 }}
                  autoFocus
                />
                <button className="btn btn-dark" onClick={saveManualRate} disabled={savingRate} style={{ fontSize: 13, padding: "6px 14px" }}>
                  {savingRate ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingRate(false)} style={{ fontSize: 13, padding: "6px 14px", color: "var(--faint)" }}>Cancel</button>
              </div>
            ) : data.rate ? (
              <>
                <div className="flex items-end gap-8 mt-1">
                  <div>
                    <p style={{ fontSize: 11.5, color: "var(--faint)" }}>24 karat</p>
                    <p className="display" style={{ fontSize: 22 }}>{formatPaiseExact(data.rate.per24kGramPaise)}<span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 400 }}> /g</span></p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11.5, color: "var(--faint)" }}>22 karat</p>
                    <p className="display" style={{ fontSize: 22 }}>{formatPaiseExact(data.rate.per22kGramPaise)}<span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 400 }}> /g</span></p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11.5, color: "var(--faint)" }}>18 karat</p>
                    <p className="display" style={{ fontSize: 22 }}>{formatPaiseExact(data.rate.per18kGramPaise)}<span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 400 }}> /g</span></p>
                  </div>
                </div>
                <p className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10 }}>
                  <RefreshCw size={11} />
                  {rateSourceLabel(data.rate.source)} · {new Date(data.rate.fetchedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </>
            ) : (
              <p style={{ color: "var(--faint)", fontSize: 13.5, marginTop: 4 }}>
                Couldn&apos;t fetch a live rate right now — set one by hand to value your items.
              </p>
            )}
          </div>

          {/* Per-account items */}
          {data.accounts.length === 0 ? (
            <div className="card" style={{ padding: 20, color: "var(--faint)", fontSize: 14 }}>
              No Gold account yet — add one from Update balances first, then come back here to log individual items.
            </div>
          ) : (
            data.accounts.map((account) => {
              const items = data.items.filter((i) => i.accountId === account.id);
              const totalGrams = items.reduce((s, i) => s + i.grams, 0);
              const totalValuePaise = items.reduce((s, i) => s + (effectiveValuePaise(i, data.rate) ?? 0), 0);
              const itemsWithBuyPrice = items.filter((i) => i.buyPricePaise !== undefined);
              const gainPaise = itemsWithBuyPrice.length > 0
                ? itemsWithBuyPrice.reduce((s, i) => s + ((effectiveValuePaise(i, data.rate) ?? 0) - i.buyPricePaise!), 0)
                : null;
              const hasAnyValue = items.some((i) => effectiveValuePaise(i, data.rate) !== null);

              return (
                <div key={account.id} className="card mb-6" style={{ padding: 20 }}>
                  <div className="flex items-center justify-between mb-1">
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{heldByLabel(account.heldBy)}&apos;s gold</p>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{hasAnyValue ? formatPaiseExact(totalValuePaise) : "—"}</p>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--faint)", marginBottom: 14 }}>
                    {totalGrams > 0 ? `${totalGrams.toFixed(2)} g total` : "No items yet"}
                    {gainPaise !== null && (
                      <span style={{ color: gainPaise >= 0 ? "var(--green)" : "var(--red)" }}> · {gainPaise >= 0 ? "+" : ""}{formatPaiseExact(gainPaise)} vs. buy price</span>
                    )}
                  </p>

                  {items.map((item) => (
                    <GoldItemRow key={item.id} item={item} rate={data.rate} onDelete={() => deleteItem(item.id, item.name)} onSaved={() => mutate(KEY)} />
                  ))}

                  {addingFor === account.id ? (
                    <AddGoldItemForm accountId={account.id} onDone={() => { setAddingFor(null); mutate(KEY); }} onCancel={() => setAddingFor(null)} />
                  ) : (
                    <button
                      onClick={() => setAddingFor(account.id)}
                      className="flex items-center gap-1.5"
                      style={{ fontSize: 13, color: "var(--indigo)", marginTop: 10, padding: "6px 0" }}
                    >
                      <Plus size={14} /> Add item
                    </button>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

function GoldItemRow({ item, rate, onDelete, onSaved }: { item: NwGoldItem; rate: NwGoldPageResponse["rate"]; onDelete: () => void; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [grams, setGrams] = useState(String(item.grams));
  const [karat, setKarat] = useState<24 | 22 | 18>(item.karat);
  const [buyPrice, setBuyPrice] = useState(item.buyPricePaise !== undefined ? String(item.buyPricePaise / 100) : "");
  const [buyDate, setBuyDate] = useState(item.buyDate);
  const [manualValue, setManualValue] = useState(item.manualValuePaise !== undefined ? String(item.manualValuePaise / 100) : "");
  const [saving, setSaving] = useState(false);

  const currentValuePaise = effectiveValuePaise(item, rate);
  const gainPaise = currentValuePaise !== null && item.buyPricePaise !== undefined ? currentValuePaise - item.buyPricePaise : null;
  const isManual = item.manualValuePaise !== undefined;

  const save = async () => {
    const gramsNum = Number(grams);
    if (!name.trim() || !gramsNum || gramsNum <= 0) return;
    const buyPricePaise = buyPrice.trim() === "" ? null : parseRupeesToPaise(buyPrice);
    if (buyPrice.trim() !== "" && buyPricePaise === null) return;
    const manualValuePaise = manualValue.trim() === "" ? null : parseRupeesToPaise(manualValue);
    if (manualValue.trim() !== "" && manualValuePaise === null) return;
    setSaving(true);
    try {
      await fetch(`/api/networth/gold/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), grams: gramsNum, karat, buyPricePaise, buyDate, manualValuePaise }),
      });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2" style={{ padding: "10px 0", borderTop: "1px solid var(--line2)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" style={{ flex: "1 1 140px", borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
          <select value={karat} onChange={(e) => setKarat(Number(e.target.value) as 24 | 22 | 18)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }}>
            <option value={24}>24k</option>
            <option value={22}>22k</option>
            <option value={18}>18k</option>
          </select>
          <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="Grams" style={{ width: 70, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
          <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="number" inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="Buy price" style={{ width: 140, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
          <input type="number" inputMode="decimal" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Current value" style={{ width: 150, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
          <button className="btn btn-dark" onClick={save} disabled={saving} style={{ fontSize: 12.5, padding: "6px 12px" }}>{saving ? "…" : "Save"}</button>
          <button onClick={() => setEditing(false)} style={{ fontSize: 12.5, color: "var(--faint)" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: "1px solid var(--line2)" }}>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 13.5 }}>{item.name}</p>
        <p style={{ fontSize: 11.5, color: "var(--faint)" }}>
          {item.karat}k · {item.grams}g · {item.buyPricePaise !== undefined
            ? `bought ${new Date(item.buyDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} for ${formatPaiseExact(item.buyPricePaise)}`
            : `added ${new Date(item.buyDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>
          {currentValuePaise !== null ? formatPaiseExact(currentValuePaise) : "—"}
          {isManual && <span style={{ fontSize: 10.5, color: "var(--faint)", fontWeight: 400 }}> (manual)</span>}
        </p>
        {gainPaise !== null && (
          <p style={{ fontSize: 11, color: gainPaise >= 0 ? "var(--green)" : "var(--red)" }}>{gainPaise >= 0 ? "+" : ""}{formatPaiseExact(gainPaise)}</p>
        )}
      </div>
      <button aria-label="Edit" onClick={() => setEditing(true)} style={{ color: "var(--faint)", padding: 4 }}><Pencil size={13} /></button>
      <button aria-label="Delete" onClick={onDelete} style={{ color: "var(--faint)", padding: 4 }}><Trash2 size={13} /></button>
    </div>
  );
}

function AddGoldItemForm({ accountId, onDone, onCancel }: { accountId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [karat, setKarat] = useState<24 | 22 | 18>(22);
  const [grams, setGrams] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const gramsNum = Number(grams);
    if (!name.trim() || !gramsNum || gramsNum <= 0) return;
    const buyPricePaise = buyPrice.trim() === "" ? undefined : parseRupeesToPaise(buyPrice);
    if (buyPrice.trim() !== "" && buyPricePaise == null) return;
    const manualValuePaise = manualValue.trim() === "" ? undefined : parseRupeesToPaise(manualValue);
    if (manualValue.trim() !== "" && manualValuePaise == null) return;
    setSaving(true);
    try {
      await fetch("/api/networth/gold/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, name: name.trim(), karat, grams: gramsNum, buyDate,
          ...(buyPricePaise !== undefined ? { buyPricePaise } : {}),
          ...(manualValuePaise !== undefined ? { manualValuePaise } : {}),
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" style={{ padding: "10px 0", borderTop: "1px solid var(--line2)", marginTop: 4 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold chain" style={{ flex: "1 1 140px", borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
        <select value={karat} onChange={(e) => setKarat(Number(e.target.value) as 24 | 22 | 18)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }}>
          <option value={24}>24k</option>
          <option value={22}>22k</option>
          <option value={18}>18k</option>
        </select>
        <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="Grams" style={{ width: 70, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
        <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="number" inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="Buy price" style={{ width: 140, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
        <input type="number" inputMode="decimal" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Current value" style={{ width: 150, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 8px", fontSize: 13 }} />
        <button className="btn btn-dark" onClick={submit} disabled={saving} style={{ fontSize: 12.5, padding: "6px 12px" }}>{saving ? "…" : "Add"}</button>
        <button onClick={onCancel} style={{ fontSize: 12.5, color: "var(--faint)" }}>Cancel</button>
      </div>
      <p style={{ fontSize: 11, color: "var(--faint)" }}>
        No buy price? Leave it blank and enter what it&apos;s worth today under &quot;Current value&quot; instead.
      </p>
    </div>
  );
}
