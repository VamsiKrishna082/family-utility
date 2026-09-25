"use client";

import { useState } from "react";
import useSWR from "swr";
import { rangeLabel } from "@/lib/trips/logic";
import type { TripsResponse } from "@/lib/trips/types";
import { Chip, fetcher, labelStyle, Modal, send } from "@/components/trips/shared";

const PARTS = [
  ["packing", "Packing list"],
  ["todos", "To-dos"],
  ["plan", "Itinerary"],
  ["stays", "Stays"],
  ["links", "Saved links"],
  ["bookings", "Bookings (without dates/PNRs)"],
] as const;
type Part = (typeof PARTS)[number][0];

/** Reuse lists from an earlier trip — packing and to-dos come back unticked, itinerary as ideas. */
export function CopyFromTrip({ trip, onClose, onDone }: { trip: { id: string; destination: string }; onClose: () => void; onDone: () => void }) {
  const { data } = useSWR<TripsResponse>("/api/trips", fetcher);
  const others = (data?.items ?? []).filter((t) => t.id !== trip.id)
    // same destination first
    .sort((a, b) => Number(b.destination.toLowerCase() === trip.destination.toLowerCase()) - Number(a.destination.toLowerCase() === trip.destination.toLowerCase()) || (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const [source, setSource] = useState<string>("");
  const [parts, setParts] = useState<Part[]>(["packing", "todos"]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, number> | null>(null);
  const src = others.find((t) => t.id === source);
  const count = (p: Part) => (src ? (src as unknown as Record<Part, unknown[]>)[p]?.length ?? 0 : 0);

  const copy = async () => {
    setBusy(true);
    try {
      const res = await send<{ added: Record<string, number> }>(`/api/trips/${trip.id}/copy`, "POST", { sourceId: source, parts });
      setDone(res.added);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Copy from a past trip" onClose={onClose}>
      {done ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 14 }}>Added {Object.entries(done).map(([k, n]) => `${n} ${PARTS.find((p) => p[0] === k)?.[1].toLowerCase().replace(/ \(.*/, "")}`).join(", ")}. Anything already on this trip was skipped.</p>
          <button className="btn btn-dark" onClick={onClose}>Done</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <span style={labelStyle}>From which trip</span>
            {!others.length && <p style={{ fontSize: 13, color: "var(--faint)" }}>No other trips yet.</p>}
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {others.map((t) => (
                <label key={t.id} className="flex items-center gap-2" style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${source === t.id ? "var(--ink)" : "var(--line)"}`, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" name="copy-src" checked={source === t.id} onChange={() => setSource(t.id)} />
                  <span className="flex-1 truncate">{t.name}</span>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>{t.startDate && t.endDate ? rangeLabel(t.startDate, t.endDate) : "idea"}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span style={labelStyle}>What to copy</span>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {PARTS.map(([k, label]) => (
                <Chip key={k} on={parts.includes(k)} onClick={() => setParts(parts.includes(k) ? parts.filter((x) => x !== k) : [...parts, k])}>
                  {label}{src ? ` · ${count(k)}` : ""}
                </Chip>
              ))}
            </div>
          </div>
          <button className="btn btn-dark" disabled={!source || !parts.length || busy} onClick={copy}>{busy ? "Copying…" : "Copy"}</button>
        </div>
      )}
    </Modal>
  );
}
