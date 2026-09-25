"use client";

import { useState } from "react";
import { fmt, Sheet } from "@/components/food/parts";
import { send } from "@/components/food/api";
import { ACTIVITY_FACTORS, computeTargets, DEFAULT_DEFICIT_PCT, MAX_DEFICIT_PCT } from "@/lib/fa/targets";
import type { FaPersonDay, FaSex } from "@/lib/fa/types";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <label htmlFor={id} className="fa-label">{label}</label>
      {children}
    </div>
  );
}

/**
 * Profile and targets (food.md "Targets"): Mifflin-St Jeor maintenance,
 * default 15% deficit (0–20%), never below BMR. A typed target under the
 * floor is raised back to it with a plain note — no alarm, no judgement.
 */
export function SetupSheet({ pd, date, onClose, onSaved }: { pd: FaPersonDay; date: string; onClose: () => void; onSaved: () => void }) {
  const p = pd.profile;
  const [height, setHeight] = useState(p ? String(p.heightCm) : "");
  const [weight, setWeight] = useState(p ? String(p.weightKg) : "");
  const [birthYear, setBirthYear] = useState(p ? String(p.birthYear) : "");
  const [sex, setSex] = useState<FaSex | null>(p?.sex ?? null);
  const [activityFactor, setActivityFactor] = useState(p?.activityFactor ?? 1.375);
  const [deficit, setDeficit] = useState(p?.deficitPct ?? DEFAULT_DEFICIT_PCT);
  const [manual, setManual] = useState(p?.manualTargetKcal ? String(p.manualTargetKcal) : "");
  const [stepGoal, setStepGoal] = useState(String(p?.stepGoal ?? 10000));
  const [reminders, setReminders] = useState(p?.remindersOn ?? true);
  const [todayWeight, setTodayWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const h = Number(height), w = Number(weight), by = Number(birthYear);
  const valid = sex !== null && h >= 120 && h <= 230 && w >= 30 && w <= 250 && by >= 1930 && by <= new Date().getFullYear() - 15;
  const preview = valid
    ? computeTargets({ heightCm: h, weightKg: w, birthYear: by, sex: sex!, activityFactor, deficitPct: deficit, manualTargetKcal: Number(manual) || undefined })
    : null;

  const save = async () => {
    if (!valid || !sex) return;
    setBusy(true);
    setError("");
    try {
      const res = await send<{ flooredManual: boolean }>("/api/fa/profile", "PUT", {
        heightCm: h, weightKg: w, birthYear: by, sex, activityFactor, deficitPct: deficit,
        manualTargetKcal: Number(manual) ? Math.round(Number(manual)) : null,
        stepGoal: Math.max(1000, Math.round(Number(stepGoal) || 10000)),
        remindersOn: reminders,
      });
      onSaved();
      if (res.flooredManual) {
        setNote("Saved. The target you typed was below your floor, so the floor is used instead.");
        setBusy(false);
      } else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  };

  const logWeight = async () => {
    const kg = Number(todayWeight);
    if (!(kg >= 30 && kg <= 250)) return;
    setBusy(true);
    setError("");
    try {
      const res = await send<{ weightAvg7: number }>("/api/fa/weight", "PUT", { date, weightKg: kg });
      setWeight(String(res.weightAvg7));
      setTodayWeight("");
      setNote(`Logged. 7-day average: ${res.weightAvg7} kg${p ? " — targets updated from it" : ""}.`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} label="Targets">
      <div className="flex flex-col" style={{ gap: 16 }}>
        <div className="flex flex-col" style={{ gap: 4 }}>
          <h2 className="fa-serif" style={{ margin: 0, fontSize: 22 }}>{p ? "Your targets" : "Set up your targets"}</h2>
          <span style={{ fontSize: 13, color: "var(--fa-dim)" }}>Only you can change these. Both of you can see each other&apos;s day.</span>
        </div>

        <LimitCard pd={pd} onSaved={onSaved} />

        {p && (
          <div className="fa-card flex flex-col" style={{ padding: 14, gap: 8 }}>
            <span className="fa-label">Log today&apos;s weight</span>
            <div className="flex" style={{ gap: 8 }}>
              <input className="fa-input flex-1" inputMode="decimal" placeholder={pd.weightAvg7 ? `7-day avg ${pd.weightAvg7} kg` : "kg"} value={todayWeight} onChange={(e) => setTodayWeight(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Today's weight in kg" />
              <button className="fa-btn fa-btn-dark" disabled={busy || !(Number(todayWeight) >= 30)} onClick={logWeight}>Log</button>
            </div>
            <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>Targets follow your 7-day average, not a single day&apos;s reading.</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <Field id="fa-h" label="Height cm"><input id="fa-h" className="fa-input" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))} /></Field>
          <Field id="fa-w" label="Weight kg"><input id="fa-w" className="fa-input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))} /></Field>
          <Field id="fa-y" label="Born"><input id="fa-y" className="fa-input" inputMode="numeric" placeholder="1995" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <span className="fa-label">Body (for the BMR formula)</span>
          <div className="flex" style={{ gap: 8 }}>
            <button className="fa-chip" aria-pressed={sex === "female"} onClick={() => setSex("female")}>Female</button>
            <button className="fa-chip" aria-pressed={sex === "male"} onClick={() => setSex("male")}>Male</button>
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <span className="fa-label">Usual activity</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {ACTIVITY_FACTORS.map((a) => (
              <button key={a.value} className="fa-chip" aria-pressed={a.value === activityFactor} onClick={() => setActivityFactor(a.value)}>{a.label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="fa-def" className="fa-label">Deficit · {deficit}%</label>
          <input id="fa-def" type="range" min={0} max={MAX_DEFICIT_PCT} step={1} value={deficit} onChange={(e) => setDeficit(Number(e.target.value))} style={{ accentColor: "var(--fa-accent)" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <Field id="fa-m" label="Own target (optional)"><input id="fa-m" className="fa-input" inputMode="numeric" placeholder="kcal" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field id="fa-sg" label="Step goal"><input id="fa-sg" className="fa-input" inputMode="numeric" value={stepGoal} onChange={(e) => setStepGoal(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>

        {preview && (
          <div className="fa-card flex flex-col" style={{ padding: 14, gap: 6, fontSize: 13 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{fmt(preview.targetKcal)} kcal a day</span>
            <span style={{ color: "var(--fa-dim)" }}>
              Maintenance {fmt(preview.maintenanceKcal)} · floor (BMR) {fmt(preview.bmrKcal)} · protein {preview.proteinG} g · fat {preview.fatG} g · carbs {preview.carbsG} g · fibre {preview.fibreG} g
            </span>
            {preview.flooredManual && (
              <span style={{ color: "var(--fa-dim)" }}>
                {fmt(Number(manual))} kcal is below your floor, so {fmt(preview.targetKcal)} is used. Eating much less than this is something to plan with a doctor or dietitian.
              </span>
            )}
          </div>
        )}

        <label className="flex items-center justify-between" style={{ fontSize: 14, fontWeight: 600 }}>
          Evening “log dinner?” nudge
          <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--fa-accent)" }} />
        </label>

        {note && <p style={{ margin: 0, fontSize: 13, color: "var(--fa-accent)" }}>{note}</p>}
        {error && <p style={{ margin: 0, fontSize: 13, color: "#b44b44" }}>{error}</p>}
        <button className="fa-btn fa-btn-primary" style={{ height: 52, fontSize: 15 }} disabled={busy || !valid} onClick={save}>
          {busy ? "Saving…" : "Save targets"}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Your own daily calorie limit — no profile needed. "Don't let me log past
 * it" stops food that would take the day over; "Just warn me" logs it with
 * a note. With a profile, a limit under your BMR is raised to BMR.
 */
function LimitCard({ pd, onSaved }: { pd: FaPersonDay; onSaved: () => void }) {
  const [kcal, setKcal] = useState(pd.limit ? String(pd.limit.kcal) : "");
  const [mode, setMode] = useState<"block" | "warn">(pd.limit?.mode ?? "block");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const n = Number(kcal);
  const valid = n >= 800 && n <= 6000;
  const floored = valid && pd.profile && n < pd.profile.bmrKcal;

  const save = async (value: number | null) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await send<{ target: number | null; floored: boolean }>("/api/fa/limit", "PUT", { kcal: value, mode });
      setMsg(value === null ? "Limit removed." : res.floored ? `Saved — your target is ${fmt(res.target ?? 0)} kcal (your BMR floor).` : `Saved — ${fmt(value)} kcal a day.`);
      if (value === null) setKcal("");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fa-card flex flex-col" style={{ padding: 14, gap: 10 }}>
      <span className="fa-label">Daily calorie limit</span>
      <div className="flex" style={{ gap: 8 }}>
        <input className="fa-input flex-1" inputMode="numeric" placeholder="e.g. 1800" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} aria-label="Daily calorie limit" />
        <span className="flex items-center" style={{ fontSize: 13, color: "var(--fa-dim)" }}>kcal</span>
      </div>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <button className="fa-chip" aria-pressed={mode === "block"} onClick={() => setMode("block")}>Don&apos;t let me log past it</button>
        <button className="fa-chip" aria-pressed={mode === "warn"} onClick={() => setMode("warn")}>Just warn me</button>
      </div>
      {floored && (
        <span style={{ fontSize: 12.5, color: "var(--fa-dim)" }}>
          That&apos;s below your BMR ({fmt(pd.profile!.bmrKcal)} kcal), so {fmt(pd.profile!.bmrKcal)} will be used. Eating much less than this is something to plan with a doctor or dietitian.
        </span>
      )}
      <div className="flex" style={{ gap: 8 }}>
        <button className="fa-btn fa-btn-dark flex-1" disabled={busy || !valid} onClick={() => save(n)}>{busy ? "Saving…" : pd.limit ? "Update limit" : "Set limit"}</button>
        {pd.limit && <button className="fa-btn" disabled={busy} onClick={() => save(null)}>Remove</button>}
      </div>
      <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>
        {msg || (pd.profile ? "Overrides the target worked out from your profile." : "Works on its own — no need to fill in the profile below.")}
      </span>
    </div>
  );
}
