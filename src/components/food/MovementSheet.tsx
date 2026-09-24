"use client";

import { useState } from "react";
import { fmt, Sheet } from "@/components/food/parts";
import { send } from "@/components/food/api";
import { burnedKcal } from "@/lib/fa/targets";
import { FA_ACTIVITIES, FA_ACTIVITY_LABEL, type FaActivity, type FaPersonDay } from "@/lib/fa/types";

/**
 * Steps and workouts are typed in — a web app can't read Health Connect or
 * HealthKit. Today's steps default to your last-7-day average so it's one tap.
 */
export function MovementSheet({ pd, date, onClose, onSaved }: { pd: FaPersonDay; date: string; onClose: () => void; onSaved: () => void }) {
  const d = pd.day;
  const [steps, setSteps] = useState(d?.steps ? String(d.steps) : "");
  const [minutes, setMinutes] = useState(d?.workoutMin ? String(d.workoutMin) : "");
  const [activity, setActivity] = useState<FaActivity>(d?.activity ?? "walk");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stepsN = Math.max(0, Math.round(Number(steps) || 0));
  const minN = Math.max(0, Math.round(Number(minutes) || 0));
  const estimate = burnedKcal({ steps: stepsN, workoutMin: minN, activity, weightKg: pd.profile?.weightKg ?? 70 });

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await send("/api/fa/activity", "PUT", { date, steps: stepsN, workoutMin: minN, activity: minN > 0 ? activity : undefined });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} label="Movement">
      <div className="flex flex-col" style={{ gap: 16 }}>
        <h2 className="fa-serif" style={{ margin: 0, fontSize: 22 }}>Movement</h2>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="fa-steps" className="fa-label">Steps</label>
          <input id="fa-steps" className="fa-input" inputMode="numeric" placeholder="0" value={steps} onChange={(e) => setSteps(e.target.value.replace(/\D/g, ""))} />
          {pd.stepsDefault && !steps && (
            <button className="fa-chip" style={{ alignSelf: "flex-start" }} onClick={() => setSteps(String(pd.stepsDefault))}>
              Your usual · {fmt(pd.stepsDefault)}
            </button>
          )}
        </div>

        <div className="flex flex-col" style={{ gap: 8 }}>
          <label htmlFor="fa-min" className="fa-label">Workout minutes</label>
          <input id="fa-min" className="fa-input" inputMode="numeric" placeholder="0" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} />
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {FA_ACTIVITIES.map((a) => (
              <button key={a} className="fa-chip" aria-pressed={a === activity} onClick={() => setActivity(a)}>{FA_ACTIVITY_LABEL[a]}</button>
            ))}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--fa-dim)" }}>
          About <strong style={{ color: "var(--fa-ink)" }}>{fmt(estimate)} kcal</strong> burned — an estimate from steps, minutes and {pd.profile ? "your weight" : "an average weight (set up your profile for a better one)"}.
        </p>
        {error && <p style={{ margin: 0, fontSize: 13, color: "#b44b44" }}>{error}</p>}
        <button className="fa-btn fa-btn-primary" style={{ height: 52, fontSize: 15 }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Sheet>
  );
}
