"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { formatINR } from "@/lib/money";
import { WISHLIST_CATEGORIES, type WishlistItem } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function WishlistBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: WishlistItem[] }>("/api/wishlist", fetcher);
  const items = data?.items ?? [];

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>(WISHLIST_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), url: url.trim(), price: price ? Number(price) : null, category, notes: "", done: false }),
    });
    setTitle("");
    setUrl("");
    setPrice("");
    setSaving(false);
    mutate();
  };

  const toggle = async (item: WishlistItem) => {
    await fetch(`/api/wishlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: items.filter((i) => i.id !== id) }, false);
    await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
    mutate();
  };

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const Row = ({ item }: { item: WishlistItem }) => (
    <div className="flex items-center gap-3 px-4 py-3" style={{ opacity: item.done ? 0.55 : 1 }}>
      <input type="checkbox" checked={item.done} onChange={() => toggle(item)} />
      <span
        className="flex-1 min-w-0 truncate"
        style={{ fontSize: 14.5, textDecoration: item.done ? "line-through" : "none" }}
      >
        {item.title}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--indigo)", background: "#eceaf3", padding: "3px 9px", borderRadius: 999 }}>
        {item.category}
      </span>
      {item.price != null && <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{formatINR(item.price)}</span>}
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "var(--faint)" }}>
          <ExternalLink size={15} />
        </a>
      )}
      <button onClick={() => remove(item.id)} style={{ color: "var(--faint)" }} aria-label="Delete"><Trash2 size={15} /></button>
    </div>
  );

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Wishlist</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Watch, eat, buy.</p>

      <div className="card mt-7" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add something</p>
        <div className="flex flex-wrap gap-2">
          <input type="text" placeholder="What is it?" value={title} onChange={(e) => setTitle(e.target.value)}
            className="flex-1" style={{ minWidth: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}>
            {WISHLIST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" inputMode="decimal" placeholder="₹ Price (optional)" value={price} onChange={(e) => setPrice(e.target.value)}
            style={{ width: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <input type="text" placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)}
            style={{ width: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <button className="btn btn-dark flex items-center gap-1.5" onClick={add} disabled={saving}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Nothing on the list yet.</p>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {pending.map((item, i) => (
              <div key={item.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}><Row item={item} /></div>
            ))}
            {done.length > 0 && pending.length > 0 && <div style={{ borderTop: "1px solid var(--line2)" }} />}
            {done.map((item, i) => (
              <div key={item.id} style={{ borderTop: i === 0 && pending.length === 0 ? "none" : "1px solid var(--line2)" }}><Row item={item} /></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
