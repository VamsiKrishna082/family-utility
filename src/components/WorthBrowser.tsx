"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import { WORTH_CATEGORIES, type WorthAccount } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function WorthBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: WorthAccount[] }>("/api/worth", fetcher);
  const accounts = data?.items ?? [];

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"asset" | "liability">("asset");
  const [category, setCategory] = useState<string>(WORTH_CATEGORIES[0]);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { netWorth, assets, liabilities } = useMemo(() => {
    const assets = accounts.filter((a) => a.kind === "asset");
    const liabilities = accounts.filter((a) => a.kind === "liability");
    const total = (list: WorthAccount[]) => list.reduce((s, a) => s + a.value, 0);
    return { netWorth: total(assets) - total(liabilities), assets, liabilities };
  }, [accounts]);

  const add = async () => {
    const v = Number(value);
    if (!name.trim() || !v || v < 0) return;
    setSaving(true);
    await fetch("/api/worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), kind, category, value: v }),
    });
    setName("");
    setValue("");
    setSaving(false);
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: accounts.filter((a) => a.id !== id) }, false);
    await fetch(`/api/worth/${id}`, { method: "DELETE" });
    mutate();
  };

  const Group = ({ title, items, tint }: { title: string; items: WorthAccount[]; tint: string }) => (
    <div className="mb-8">
      <p style={{ color: "var(--faint)", fontSize: 12.5, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {title} · {formatINR(items.reduce((s, a) => s + a.value, 0))}
      </p>
      {items.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>None yet.</p>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {items.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: tint, flexShrink: 0 }} />
              <span style={{ fontSize: 14, flexShrink: 0, width: 130 }} className="truncate">{a.name}</span>
              <span style={{ fontSize: 13, color: "var(--faint)", flex: 1 }}>{a.category}</span>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{formatINR(a.value)}</span>
              <button onClick={() => remove(a.id)} style={{ color: "var(--faint)" }} aria-label="Delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Net worth</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>What you own, minus what you owe.</p>

      <div className="card mt-7" style={{ padding: 24 }}>
        <p style={{ color: "var(--faint)", fontSize: 13 }}>Net worth</p>
        <p className="display" style={{ fontSize: 34, marginTop: 6, color: netWorth >= 0 ? "var(--green)" : "var(--red)" }}>
          {formatINR(netWorth)}
        </p>
      </div>

      <div className="card mt-6" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add an account</p>
        <div className="flex flex-wrap gap-2">
          <div className="flex" style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden" }}>
            {(["asset", "liability"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{ padding: "9px 16px", fontSize: 13.5, fontWeight: 600, background: kind === k ? "var(--ink)" : "var(--card)", color: kind === k ? "#fff" : "var(--dim)" }}
              >
                {k === "asset" ? "Asset" : "Liability"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Name, e.g. HDFC savings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
            style={{ minWidth: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}>
            {WORTH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            inputMode="decimal"
            placeholder="₹ Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: 130, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <button className="btn btn-dark flex items-center gap-1.5" onClick={add} disabled={saving}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : (
          <>
            <Group title="Assets" items={assets} tint="var(--green)" />
            <Group title="Liabilities" items={liabilities} tint="var(--red)" />
          </>
        )}
      </div>
    </div>
  );
}
