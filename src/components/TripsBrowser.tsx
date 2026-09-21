"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/money";
import { TRIP_STATUSES, type Trip } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_TINT: Record<Trip["status"], string> = {
  planning: "var(--faint)",
  upcoming: "var(--indigo)",
  past: "var(--dim)",
};

function fmtRange(start: string, end: string): string {
  const s = new Date(start), e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${s.toLocaleDateString("en-IN", opts)} – ${e.toLocaleDateString("en-IN", { ...opts, year: "numeric" })}`;
}

export function TripsBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: Trip[] }>("/api/trips", fetcher);
  const trips = data?.items ?? [];

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const status: Trip["status"] = new Date(startDate) < new Date() ? "past" : "upcoming";
    await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), destination: destination.trim(), startDate, endDate,
        budget: Number(budget) || 0, notes: "", status,
      }),
    });
    setName("");
    setDestination("");
    setBudget("");
    setSaving(false);
    mutate();
  };

  const setStatus = async (t: Trip, status: Trip["status"]) => {
    await fetch(`/api/trips/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: trips.filter((t) => t.id !== id) }, false);
    await fetch(`/api/trips/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Trips</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Where you are going.</p>

      <div className="card mt-7" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add a trip</p>
        <div className="flex flex-wrap gap-2">
          <input type="text" placeholder="Trip name, e.g. Coorg" value={name} onChange={(e) => setName(e.target.value)}
            style={{ width: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <input type="text" placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)}
            style={{ width: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <input type="number" inputMode="decimal" placeholder="₹ Budget" value={budget} onChange={(e) => setBudget(e.target.value)}
            style={{ width: 110, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
          <button className="btn btn-dark flex items-center gap-1.5" onClick={add} disabled={saving}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div className="mt-8" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : trips.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No trips planned yet.</p>
        ) : (
          trips.map((t) => (
            <div key={t.id} className="card" style={{ padding: 18 }}>
              <div className="flex items-start justify-between">
                <p className="display" style={{ fontSize: 18 }}>{t.name}</p>
                <button onClick={() => remove(t.id)} style={{ color: "var(--faint)" }} aria-label="Delete"><Trash2 size={15} /></button>
              </div>
              {t.destination && <p style={{ color: "var(--dim)", fontSize: 13.5, marginTop: 2 }}>{t.destination}</p>}
              <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 8 }}>{fmtRange(t.startDate, t.endDate)}</p>
              {t.budget > 0 && <p style={{ fontSize: 14.5, fontWeight: 600, marginTop: 8 }}>{formatINR(t.budget)}</p>}

              <div className="flex gap-1.5 mt-4">
                {TRIP_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(t, s)}
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
                      background: t.status === s ? STATUS_TINT[s] : "var(--line2)",
                      color: t.status === s ? "#fff" : "var(--faint)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
