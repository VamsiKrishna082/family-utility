"use client";

import type { ReactNode } from "react";
import { FA_MEALS, FA_MEAL_LABEL, FA_STATUS_LABEL, type FaEntry, type FaMeal, type FaPersonDay, type FaStatus } from "@/lib/fa/types";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
const g = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-IN");

export const STATUS_COLOR: Record<FaStatus, string> = {
  on: "var(--fa-accent)", over: "var(--fa-over)", under: "var(--fa-under)", none: "var(--fa-none)",
};

export function StatusPill({ status }: { status: FaStatus }) {
  return (
    <span style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "#fff", background: status === "on" ? "var(--fa-accent)" : "var(--fa-hero-line)" }}>
      {FA_STATUS_LABEL[status]}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <span style={{ fontSize: 12, color: "var(--fa-hero-dim)" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

/**
 * The dark hero: kcal left (net of burned) with eaten/burned/target beneath.
 * Neutral wording when over — "180 kcal over", never anything judgemental.
 */
export function Hero({ pd, isToday, title, wide, onSetup }: { pd: FaPersonDay; isToday: boolean; title?: ReactNode; wide?: boolean; onSetup?: () => void }) {
  const day = pd.day;
  const eaten = day?.eatenKcal ?? 0;
  const burned = day?.burnedKcal ?? 0;
  const target = pd.targetKcal;
  const left = target !== null ? target - (eaten - burned) : null;
  const pct = target ? Math.max(0, Math.min(100, ((eaten - burned) / target) * 100)) : 0;
  const status: FaStatus = day?.status ?? "none";

  return (
    <section style={{ padding: wide ? 24 : 20, borderRadius: wide ? 18 : 20, background: "var(--fa-hero)", color: "#fff", display: "flex", flexDirection: "column", gap: wide ? 14 : 16 }}>
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        {title ?? <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fa-hero-dim)" }}>{isToday ? "Left today" : "Left that day"}</span>}
        <StatusPill status={status} />
      </div>
      {left === null ? (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <span className="fa-serif" style={{ fontSize: wide ? 36 : 40, lineHeight: 1 }}>{fmt(eaten)} kcal</span>
          {onSetup ? (
            <button onClick={onSetup} className="fa-btn" style={{ alignSelf: "flex-start", background: "#fff" }}>Set your daily target</button>
          ) : (
            <span style={{ fontSize: 13, color: "var(--fa-hero-dim)" }}>No target set yet</span>
          )}
        </div>
      ) : (
        <span className="fa-serif" style={{ fontSize: wide ? 40 : 44, lineHeight: 1 }}>
          {left >= 0 ? `${fmt(left)} kcal${wide ? " left" : ""}` : `${fmt(-left)} kcal over`}
        </span>
      )}
      {/* marginTop auto: when a desktop row stretches two heroes to one height, bars and stats still line up */}
      <div style={{ height: 10, borderRadius: 999, background: "var(--fa-hero-line)", overflow: "hidden", marginTop: "auto" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--fa-hero-bar)", transition: "width .3s ease" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${wide ? 4 : 3}, minmax(0, 1fr))`, gap: 10, paddingTop: 12, borderTop: "1px solid var(--fa-hero-line)" }}>
        <HeroStat label="Eaten" value={fmt(eaten)} />
        <HeroStat label="Burned" value={fmt(burned)} />
        {wide && <HeroStat label="Steps" value={fmt(day?.steps ?? 0)} />}
        <HeroStat label="Target" value={target !== null ? fmt(target) : "—"} />
      </div>
    </section>
  );
}

export function Macros({ pd, wide }: { pd: FaPersonDay; wide?: boolean }) {
  const d = pd.day;
  const p = pd.profile;
  const rows: [string, number, number | null, string][] = [
    ["Protein", d?.protein ?? 0, p?.proteinG ?? null, "var(--fa-accent)"],
    ["Carbs", d?.carbs ?? 0, p?.carbsG ?? null, "var(--fa-carbs)"],
    ["Fat", d?.fat ?? 0, p?.fatG ?? null, "var(--fa-fat)"],
    ["Fibre", d?.fibre ?? 0, p?.fibreG ?? null, "var(--fa-fibre)"],
  ];
  return (
    <section className="fa-card" style={{ padding: wide ? 22 : 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="fa-serif" style={{ margin: 0, fontSize: wide ? 20 : 19 }}>Macros</h2>
      {rows.map(([name, have, goal, color]) => {
        const label = goal ? `${g(have)} / ${fmt(goal)} g` : `${g(have)} g`;
        const bar = (
          <div className="fa-bar" style={wide ? { height: 10 } : undefined}>
            <div style={{ width: `${goal ? Math.min(100, (have / goal) * 100) : 0}%`, background: color }} />
          </div>
        );
        return wide ? (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "80px minmax(0, 1fr) 110px", gap: 14, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
            {bar}
            <span style={{ fontSize: 13, textAlign: "right", color: "var(--fa-dim)" }}>{label}</span>
          </div>
        ) : (
          <div key={name} className="flex flex-col" style={{ gap: 6 }}>
            <div className="flex justify-between" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span style={{ color: "var(--fa-dim)" }}>{label}</span>
            </div>
            {bar}
          </div>
        );
      })}
    </section>
  );
}

export function entryDetail(e: FaEntry): string {
  const byWeight = /^\d+(\.\d+)? g$/.test(e.servingLabel);
  const weight = e.grams && !byWeight ? ` · ${fmt(e.grams)} g` : "";
  if (e.qty === 1) return `${e.servingLabel}${weight}`;
  const each = Math.round(e.kcal / e.qty);
  return `${e.qty} × ${e.servingLabel} · ${fmt(each)} kcal each${weight}`;
}

export function byMeal(entries: FaEntry[]): Record<FaMeal, FaEntry[]> {
  const out = { breakfast: [], lunch: [], snacks: [], dinner: [] } as Record<FaMeal, FaEntry[]>;
  for (const e of entries) out[e.meal].push(e);
  return out;
}

/** Phone meal card: items with their detail, and "+ Add to lunch" when it's your log. */
export function MealCard({ meal, items, editable, onAdd, onItem }: { meal: FaMeal; items: FaEntry[]; editable: boolean; onAdd: () => void; onItem: (e: FaEntry) => void }) {
  const kcal = items.reduce((s, e) => s + e.kcal, 0);
  return (
    <div className="fa-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h2 className="fa-serif" style={{ margin: 0, fontSize: 18 }}>{FA_MEAL_LABEL[meal]}</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fa-dim)" }}>{items.length ? `${fmt(kcal)} kcal` : "—"}</span>
      </div>
      {items.map((e) => (
        <button
          key={e.id}
          onClick={() => editable && onItem(e)}
          disabled={!editable}
          className="flex justify-between items-center text-left"
          style={{ gap: 12, paddingTop: 8, borderTop: "1px solid var(--fa-line2)", cursor: editable ? "pointer" : "default" }}
        >
          <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
            <span className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>
              {e.name}
              {e.source === "ai" && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fa-dim)" }}> · estimate</span>}
            </span>
            <span className="truncate" style={{ fontSize: 12, color: "var(--fa-dim)" }}>{entryDetail(e)}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{fmt(e.kcal)}</span>
        </button>
      ))}
      {editable && (
        <button
          onClick={onAdd}
          style={{ marginTop: 6, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, border: "1px dashed #c9c1b0", fontSize: 14, fontWeight: 600, color: "var(--fa-accent)" }}
        >
          + Add to {FA_MEAL_LABEL[meal].toLowerCase()}
        </button>
      )}
    </div>
  );
}

/** Desktop meal list: one row per meal, items summarised. */
export function MealsSummary({ entries, onMeal }: { entries: FaEntry[]; onMeal?: (m: FaMeal) => void }) {
  const grouped = byMeal(entries);
  return (
    <section className="fa-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 className="fa-serif" style={{ margin: "0 0 4px", fontSize: 20 }}>Meals</h2>
      {FA_MEALS.map((m) => {
        const items = grouped[m];
        const row = (
          <>
            <span className="flex flex-col min-w-0 text-left" style={{ gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{FA_MEAL_LABEL[m]}</span>
              <span className="truncate" style={{ fontSize: 12, color: "var(--fa-dim)" }}>{items.length ? items.map((e) => e.name).join(", ") : "Not logged yet"}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{items.length ? fmt(items.reduce((s, e) => s + e.kcal, 0)) : "—"}</span>
          </>
        );
        const style = { gap: 12, padding: "10px 0", borderTop: "1px solid var(--fa-line2)" };
        return onMeal ? (
          <button key={m} onClick={() => onMeal(m)} className="flex justify-between items-center w-full" style={style}>{row}</button>
        ) : (
          <div key={m} className="flex justify-between items-center" style={style}>{row}</div>
        );
      })}
    </section>
  );
}

export function Movement({ pd, editable, onEdit, wide }: { pd: FaPersonDay; editable: boolean; onEdit: () => void; wide?: boolean }) {
  const d = pd.day;
  const goal = pd.profile?.stepGoal ?? 10000;
  const steps = d?.steps ?? 0;
  const pct = Math.round((steps / goal) * 100);
  const stat = (label: string, value: string) => (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{value}</span>
    </div>
  );
  return (
    <section className="fa-card" style={{ padding: wide ? 22 : 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flex justify-between items-baseline" style={{ minHeight: 44 }}>
        <h2 className="fa-serif" style={{ margin: 0, fontSize: wide ? 20 : 19 }}>Movement</h2>
        {editable && <button className="fa-btn" onClick={onEdit}>Edit</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {stat("Steps", fmt(steps))}
        {stat("Workout", `${d?.workoutMin ?? 0} min`)}
        {stat("Burned", fmt(d?.burnedKcal ?? 0))}
      </div>
      <div className="fa-bar"><div style={{ width: `${Math.min(100, pct)}%`, background: "var(--fa-accent)" }} /></div>
      <span style={{ fontSize: 12, color: "var(--fa-dim)" }}>
        {pct}% of {pd.isYou ? "your" : `${pd.person.name}’s`} {fmt(goal)} step goal · burned is an estimate
      </span>
    </section>
  );
}

const weekday = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

export function Week({ pd }: { pd: FaPersonDay }) {
  const week = pd.strip14.slice(-7);
  return (
    <section className="fa-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="fa-serif" style={{ margin: 0, fontSize: 19 }}>Last 7 days</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {week.map((d) => (
          <div key={d.date} className="flex flex-col items-center" style={{ gap: 6 }} title={FA_STATUS_LABEL[d.status]}>
            <span style={{ width: 26, height: 26, borderRadius: 9, background: STATUS_COLOR[d.status] }} />
            <span style={{ fontSize: 11, color: "var(--fa-dim)" }}>{weekday(d.date)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center flex-wrap" style={{ gap: 8, paddingTop: 10, borderTop: "1px solid var(--fa-line2)" }}>
        <span className="flex flex-col" style={{ fontSize: 13, color: "var(--fa-dim)", gap: 2 }}>
          <span>On target {pd.onTarget7} of 7 days</span>
          {pd.profile && <span>Protein hit {pd.proteinHit7} of 7 days</span>}
        </span>
        <span style={{ padding: "6px 12px", borderRadius: 999, background: "var(--fa-accent-soft)", fontSize: 12, fontWeight: 700, color: "var(--fa-accent)" }}>
          Logged {pd.loggingStreak} {pd.loggingStreak === 1 ? "day" : "days"}
        </span>
      </div>
    </section>
  );
}

export function Fortnight({ pd }: { pd: FaPersonDay }) {
  const legend: [FaStatus, string][] = [["on", "On target"], ["over", "Over"], ["under", "Under"], ["none", "Not logged"]];
  return (
    <section className="fa-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="flex justify-between items-baseline">
        <h2 className="fa-serif" style={{ margin: 0, fontSize: 20 }}>Last 14 days</h2>
        <span style={{ fontSize: 13, color: "var(--fa-dim)" }}>On target {pd.onTarget14} of 14</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(14, minmax(0, 1fr))", gap: 5 }}>
        {pd.strip14.map((d) => (
          <span key={d.date} title={`${d.date} · ${FA_STATUS_LABEL[d.status]}`} style={{ display: "block", height: 26, borderRadius: 8, background: STATUS_COLOR[d.status] }} />
        ))}
      </div>
      <div className="flex flex-wrap" style={{ gap: 14, fontSize: 12, color: "var(--fa-dim)" }}>
        {legend.map(([s, label]) => (
          <span key={s} className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLOR[s] }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ onClose, children, label, full }: { onClose: () => void; children: ReactNode; label: string; full?: boolean }) {
  return (
    <div
      className="fa fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(31,29,26,.45)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={full ? "w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[20px]" : "w-full rounded-t-[20px] sm:rounded-[20px]"}
        style={{ maxWidth: 480, maxHeight: full ? undefined : "92vh", overflowY: "auto", background: "#f4f1ea", padding: "20px 16px 24px" }}
      >
        {children}
      </div>
    </div>
  );
}
