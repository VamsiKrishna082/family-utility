"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Cake, Heart, CalendarDays } from "lucide-react";
import { DATE_TYPES, type ImportantDate } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const todayISO = () => new Date().toISOString().slice(0, 10);

const ICON = { birthday: Cake, anniversary: Heart, other: CalendarDays };

/** For recurring dates, "next occurrence" ignores the stored year — birthdays don't stop happening. */
function nextOccurrence(dateISO: string, recurring: boolean): { date: Date; daysAway: number } {
  const stored = new Date(dateISO);
  if (!recurring) {
    const days = Math.round((stored.getTime() - Date.now()) / 86_400_000);
    return { date: stored, daysAway: days };
  }
  const now = new Date();
  let next = new Date(now.getFullYear(), stored.getMonth(), stored.getDate());
  if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    next = new Date(now.getFullYear() + 1, stored.getMonth(), stored.getDate());
  }
  const daysAway = Math.round((next.getTime() - now.getTime()) / 86_400_000);
  return { date: next, daysAway };
}

export function DatesBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: ImportantDate[] }>("/api/dates", fetcher);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<ImportantDate["type"]>("birthday");
  const [recurring, setRecurring] = useState(true);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => nextOccurrence(a.date, a.recurring).daysAway - nextOccurrence(b.date, b.recurring).daysAway),
    [data],
  );

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), date, type, recurring, notes: "" }),
    });
    setTitle("");
    setSaving(false);
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: (data?.items ?? []).filter((d) => d.id !== id) }, false);
    await fetch(`/api/dates/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Dates</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Birthdays and more — soonest first.</p>

      <div className="card mt-7" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add a date</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Whose / what, e.g. Amma's birthday"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
            style={{ minWidth: 180, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <select value={type} onChange={(e) => setType(e.target.value as ImportantDate["type"])} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}>
            {DATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <label className="flex items-center gap-1.5" style={{ fontSize: 13.5, color: "var(--dim)" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Repeats yearly
          </label>
          <button className="btn btn-dark flex items-center gap-1.5" onClick={add} disabled={saving}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No dates yet.</p>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {sorted.map((d, i) => {
              const { date: next, daysAway } = nextOccurrence(d.date, d.recurring);
              const Icon = ICON[d.type];
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
                  <Icon size={17} color="var(--indigo)" strokeWidth={1.8} />
                  <span className="flex-1" style={{ fontSize: 14.5 }}>{d.title}</span>
                  <span style={{ fontSize: 13, color: "var(--faint)" }}>
                    {next.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(d.recurring ? {} : { year: "numeric" }) })}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: daysAway <= 7 ? "var(--amber)" : "var(--faint)", width: 70, textAlign: "right" }}>
                    {daysAway === 0 ? "Today" : daysAway < 0 ? "Past" : `${daysAway}d`}
                  </span>
                  <button onClick={() => remove(d.id)} style={{ color: "var(--faint)" }} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
