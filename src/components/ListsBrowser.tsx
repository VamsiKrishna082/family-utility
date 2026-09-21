"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, X } from "lucide-react";
import type { ListDoc, ListItem } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ListCard({ list, onChange }: { list: ListDoc; onChange: () => void }) {
  const [text, setText] = useState("");

  const save = async (items: ListItem[]) => {
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    onChange();
  };

  const addItem = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    save([...list.items, { id: crypto.randomUUID(), text: t, done: false }]);
  };

  const toggle = (id: string) => save(list.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const removeItem = (id: string) => save(list.items.filter((i) => i.id !== id));

  const removeList = async () => {
    await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
    onChange();
  };

  const pending = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <p className="display" style={{ fontSize: 19 }}>{list.name}</p>
        <button onClick={removeList} style={{ color: "var(--faint)" }} aria-label="Delete list"><Trash2 size={15} /></button>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add an item"
          className="flex-1"
          style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 12px", fontSize: 14 }}
        />
        <button className="btn btn-plain" onClick={addItem}><Plus size={15} /></button>
      </div>

      {list.items.length === 0 ? (
        <p style={{ color: "var(--faint)", fontSize: 13.5 }}>Empty.</p>
      ) : (
        <div>
          {pending.map((item) => (
            <label key={item.id} className="flex items-center gap-2.5 py-1.5 group">
              <input type="checkbox" checked={false} onChange={() => toggle(item.id)} />
              <span className="flex-1" style={{ fontSize: 14.5 }}>{item.text}</span>
              <button onClick={() => removeItem(item.id)} style={{ color: "var(--faint)" }} aria-label="Remove"><X size={14} /></button>
            </label>
          ))}
          {done.length > 0 && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line2)" }}>
              {done.map((item) => (
                <label key={item.id} className="flex items-center gap-2.5 py-1.5">
                  <input type="checkbox" checked={true} onChange={() => toggle(item.id)} />
                  <span className="flex-1" style={{ fontSize: 14.5, color: "var(--faint)", textDecoration: "line-through" }}>{item.text}</span>
                  <button onClick={() => removeItem(item.id)} style={{ color: "var(--faint)" }} aria-label="Remove"><X size={14} /></button>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ListsBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: ListDoc[] }>("/api/lists", fetcher);
  const lists = data?.items ?? [];
  const [newListName, setNewListName] = useState("");

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setNewListName("");
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Lists</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>To-dos and groceries — make as many as you like.</p>

      <div className="card mt-7 flex gap-2" style={{ padding: 16, maxWidth: 460 }}>
        <input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createList()}
          placeholder="New list, e.g. Groceries"
          className="flex-1"
          style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
        />
        <button className="btn btn-dark" onClick={createList}>Create</button>
      </div>

      <div className="mt-8" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : lists.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No lists yet — make one above.</p>
        ) : (
          lists.map((l) => <ListCard key={l.id} list={l} onChange={() => mutate()} />)
        )}
      </div>
    </div>
  );
}
