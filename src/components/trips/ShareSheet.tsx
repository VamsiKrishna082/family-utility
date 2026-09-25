"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Printer } from "lucide-react";
import type { Trip } from "@/lib/trips/types";
import { Modal, send } from "@/components/trips/shared";

/** Private read-only journal link (days, stories, places, day photos — never money or bookings) + print. */
export function ShareSheet({ trip, onClose, onChanged }: { trip: Trip; onClose: () => void; onChanged: () => void }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = trip.shareToken && origin ? `${origin}/share/trip/${trip.shareToken}` : "";

  const act = async (method: "POST" | "DELETE") => {
    setBusy(true);
    try {
      await send(`/api/trips/${trip.id}/share`, method);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Share & print" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ fontSize: 14, color: "var(--dim)" }}>
          A read-only journal of this trip — each day&apos;s story, places, best moment and photos. Expenses, bookings, links and notes are never included.
        </p>
        {url ? (
          <>
            <div className="flex" style={{ gap: 8 }}>
              <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Share link" style={{ flex: 1, minWidth: 0, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 12.5, color: "var(--dim)" }} />
              <button className="btn btn-plain" aria-label="Copy link" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              <a className="btn btn-dark flex items-center gap-1.5" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open</a>
              <a className="btn btn-plain flex items-center gap-1.5" href={`https://wa.me/?text=${encodeURIComponent(`${trip.name} — our trip journal: ${url}`)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
              <button className="btn btn-plain" disabled={busy} onClick={() => act("POST")}>New link</button>
              <button className="btn btn-plain" disabled={busy} onClick={() => act("DELETE")} style={{ color: "var(--red)" }}>Stop sharing</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--faint)" }}>Anyone with the link can view it. “New link” or “Stop sharing” turns the old one off.</p>
          </>
        ) : (
          <button className="btn btn-dark" disabled={busy} onClick={() => act("POST")}>Create a share link</button>
        )}
        <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
          <p style={{ fontSize: 13.5, color: "var(--dim)", marginBottom: 8 }}>For a printed or PDF copy, open the journal and use Print — “Save as PDF” is in the print dialog.</p>
          {url ? (
            <a className="btn btn-plain flex items-center gap-1.5" style={{ width: "fit-content" }} href={url} target="_blank" rel="noreferrer"><Printer size={15} /> Open printable journal</a>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Create a link first to get the printable journal.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
