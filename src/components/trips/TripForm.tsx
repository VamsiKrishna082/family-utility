"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { endDateOf, rangeLabel, todayIST } from "@/lib/trips/logic";
import type { Trip } from "@/lib/trips/types";
import { ApiError, Chip, inputStyle, labelStyle, Modal, send } from "@/components/trips/shared";

/**
 * Create or edit a trip's basics. No dates = an idea ("someday"). Days sets
 * the length; the end date follows. Shortening a trip whose later days have
 * writing/photos asks first (the server refuses without confirmation).
 */
export function TripForm({ editing, onClose, onSaved }: { editing?: Trip; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [destination, setDestination] = useState(editing?.destination ?? "");
  const [hasDates, setHasDates] = useState(editing ? Boolean(editing.startDate) : true);
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayIST());
  const [days, setDays] = useState(editing?.days ?? 3);
  const [travellers, setTravellers] = useState<string[]>(editing?.travellers ?? ["Us"]);
  const [traveller, setTraveller] = useState("");
  const [budget, setBudget] = useState(editing?.budgetRupees ? String(editing.budgetRupees) : "");
  const [foreign, setForeign] = useState(Boolean(editing?.currency));
  const [currency, setCurrency] = useState(editing?.currency ?? "");
  const [rate, setRate] = useState(editing?.rate ? String(editing.rate) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDrop, setConfirmDrop] = useState<number[] | null>(null);

  const addTraveller = () => {
    const t = traveller.trim();
    if (t && !travellers.includes(t)) setTravellers([...travellers, t]);
    setTraveller("");
  };

  const save = async (confirmDropDays = false) => {
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        destination: destination.trim(),
        startDate: hasDates ? startDate : null,
        days,
        travellers: travellers.length ? travellers : ["Us"],
        budgetRupees: Number(budget) > 0 ? Number(budget) : null,
        currency: foreign && currency.trim() ? currency.trim().toUpperCase() : null,
        rate: foreign && Number(rate) > 0 ? Number(rate) : null,
        notes,
      };
      if (editing) {
        await send(`/api/trips/${editing.id}`, "PATCH", { ...body, ...(confirmDropDays ? { confirmDropDays: true } : {}) });
        onSaved(editing.id);
      } else {
        const res = await send<{ trip: Trip }>("/api/trips", "POST", { ...body, startDate: body.startDate ?? undefined, budgetRupees: body.budgetRupees ?? undefined, currency: body.currency ?? undefined, rate: body.rate ?? undefined });
        onSaved(res.trip.id);
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConfirmDrop((e.body.days as number[]) ?? []);
      else setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Edit trip" : "New trip"} onClose={onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="tf-name">Trip name</label>
          <input id="tf-name" autoFocus style={inputStyle} placeholder="e.g. Goa with friends" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="tf-dest">Destination</label>
          <input id="tf-dest" style={inputStyle} placeholder="e.g. Goa — used for weather and the map" value={destination} onChange={(e) => setDestination(e.target.value)} />
        </div>

        <div>
          <span style={labelStyle}>When</span>
          <div className="flex flex-wrap mb-2" style={{ gap: 8 }}>
            <Chip on={hasDates} onClick={() => setHasDates(true)}>We have dates</Chip>
            <Chip on={!hasDates} onClick={() => setHasDates(false)}>Just an idea for now</Chip>
          </div>
          <div className="flex items-center" style={{ gap: 10, flexWrap: "wrap" }}>
            {hasDates && (
              <input type="date" aria-label="Start date" style={{ ...inputStyle, width: 170 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            )}
            <label className="flex items-center" style={{ gap: 8, fontSize: 14 }}>
              <input type="number" min={1} max={90} aria-label="Number of days" style={{ ...inputStyle, width: 80 }} value={days} onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} />
              day{days === 1 ? "" : "s"}
            </label>
          </div>
          {hasDates && startDate && <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>{rangeLabel(startDate, endDateOf(startDate, days))}</p>}
        </div>

        <div>
          <span style={labelStyle}>Who&apos;s going</span>
          <div className="flex flex-wrap mb-2" style={{ gap: 6 }}>
            {travellers.map((t) => (
              <span key={t} className="flex items-center" style={{ gap: 6, padding: "5px 10px", borderRadius: 999, background: "var(--line2)", fontSize: 13 }}>
                {t}
                <button onClick={() => setTravellers(travellers.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} color="var(--faint)" /></button>
              </span>
            ))}
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <input style={inputStyle} placeholder="Add a friend (for shared costs)" value={traveller} onChange={(e) => setTraveller(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTraveller()} aria-label="Traveller name" />
            <button className="btn btn-plain" onClick={addTraveller} disabled={!traveller.trim()}>Add</button>
          </div>
        </div>

        <div>
          <label style={labelStyle} htmlFor="tf-budget">Total budget (₹, optional)</label>
          <input id="tf-budget" inputMode="numeric" style={inputStyle} value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>

        <div>
          <label className="flex items-center" style={{ gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={foreign} onChange={(e) => setForeign(e.target.checked)} style={{ width: 17, height: 17 }} /> Abroad — shared costs in another currency
          </label>
          {foreign && (
            <div className="flex mt-2" style={{ gap: 8 }}>
              <input style={{ ...inputStyle, width: 110 }} placeholder="USD" maxLength={8} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency code" />
              <input style={inputStyle} inputMode="decimal" placeholder="₹ per 1 unit, e.g. 83.5" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Exchange rate" />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle} htmlFor="tf-notes">Notes</label>
          <textarea id="tf-notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {confirmDrop && (
          <div className="card" style={{ padding: 12, borderColor: "var(--amber)" }}>
            <p style={{ fontSize: 13.5 }}>
              Day {confirmDrop.join(", ")} {confirmDrop.length === 1 ? "has" : "have"} writing or photos. Shortening hides {confirmDrop.length === 1 ? "it" : "them"} — nothing is deleted, and making the trip longer again brings {confirmDrop.length === 1 ? "it" : "them"} back.
            </p>
            <div className="flex mt-2" style={{ gap: 8 }}>
              <button className="btn btn-plain" onClick={() => setConfirmDrop(null)}>Cancel</button>
              <button className="btn btn-dark" onClick={() => save(true)}>Shorten anyway</button>
            </div>
          </div>
        )}
        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        <button className="btn btn-dark" disabled={!name.trim() || saving} onClick={() => save(false)}>
          {saving ? "Saving…" : editing ? "Save" : "Create trip"}
        </button>
      </div>
    </Modal>
  );
}
