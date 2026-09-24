"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { fmt, Sheet } from "@/components/food/parts";
import { send } from "@/components/food/api";
import { FA_MEALS, FA_MEAL_LABEL, FA_SOURCE_LABEL, type FaEntry, type FaMeal } from "@/lib/fa/types";

/** Tap a logged item: change how many, move it to another meal, or remove it. */
export function EntrySheet({ entry, onClose, onChanged }: { entry: FaEntry; onClose: () => void; onChanged: () => void }) {
  const [qty, setQty] = useState(entry.qty);
  const [grams, setGrams] = useState(entry.grams ? String(entry.grams) : "");
  const gramsN = Number(grams) || 0;
  const regrams = Boolean(entry.grams) && gramsN > 0 && gramsN !== entry.grams;
  const [meal, setMeal] = useState<FaMeal>(entry.meal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kcal = regrams ? Math.round((entry.kcal / entry.grams!) * gramsN) : Math.round((entry.kcal / entry.qty) * qty);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} label={`Edit ${entry.name}`}>
      <div className="flex flex-col" style={{ gap: 16 }}>
        <div className="flex flex-col" style={{ gap: 4 }}>
          <h2 className="fa-serif" style={{ margin: 0, fontSize: 22 }}>{entry.name}</h2>
          <span style={{ fontSize: 13, color: "var(--fa-dim)" }}>
            {entry.servingLabel} · {FA_SOURCE_LABEL[entry.source]}{entry.edited ? " · edited" : ""}
          </span>
        </div>

        {entry.grams ? (
          <div className="flex flex-col" style={{ gap: 8 }}>
            <div className="flex items-center justify-between" style={{ gap: 12 }}>
              <label htmlFor="fa-entry-grams" style={{ fontSize: 14, fontWeight: 600 }}>Grams</label>
              <div className="flex items-center" style={{ gap: 8 }}>
                <input
                  id="fa-entry-grams"
                  className="fa-input"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value.replace(/[^0-9.]/g, ""))}
                  style={{ width: 96, textAlign: "right" }}
                />
                <span style={{ width: 14, fontSize: 13, color: "var(--fa-dim)" }}>g</span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>Change the grams, or use How many below — calories follow either.</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 600 }}>How many</span>
          <div className="flex items-center" style={{ gap: 6 }}>
            <button className="fa-btn" aria-label="Fewer" style={{ width: 44, padding: 0 }} onClick={() => setQty((n) => Math.max(0.5, n <= 1 ? n - 0.5 : n - 1))}><Minus size={16} className="mx-auto" /></button>
            <span style={{ minWidth: 40, textAlign: "center", fontSize: 16, fontWeight: 700 }}>{qty}</span>
            <button className="fa-btn" aria-label="More" style={{ width: 44, padding: 0 }} onClick={() => setQty((n) => (n < 1 ? n + 0.5 : n + 1))}><Plus size={16} className="mx-auto" /></button>
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <span className="fa-label">Meal</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {FA_MEALS.map((m) => (
              <button key={m} className="fa-chip" aria-pressed={m === meal} onClick={() => setMeal(m)}>{FA_MEAL_LABEL[m]}</button>
            ))}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: 13, color: "#b44b44" }}>{error}</p>}

        <div className="flex" style={{ gap: 10 }}>
          <button className="fa-btn flex items-center" style={{ gap: 6, height: 52 }} disabled={busy} onClick={() => act(() => send(`/api/fa/entries/${entry.id}`, "DELETE"))}>
            <Trash2 size={16} /> Remove
          </button>
          <button
            className="fa-btn fa-btn-primary flex-1"
            style={{ height: 52, fontSize: 15 }}
            disabled={busy || (qty === entry.qty && meal === entry.meal && !regrams)}
            onClick={() => act(() => send(`/api/fa/entries/${entry.id}`, "PATCH", regrams ? { grams: gramsN, meal } : { qty, meal }))}
          >
            {busy ? "Saving…" : `Save · ${fmt(kcal)} kcal`}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
