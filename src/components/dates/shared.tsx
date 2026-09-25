"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { Cake, CalendarDays, Flower2, Heart, Sparkles, X } from "lucide-react";
import { nextOccurrence, todayIST, type Occurrence } from "@/lib/dates/logic";
import type { DtEvent, DtEventsResponse, DtType } from "@/lib/dates/types";

export const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load dates");
  return r.json();
};

export async function send<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Something went wrong");
  return r.json();
}

export type Row = { ev: DtEvent; occ: Occurrence };

/** All dates with their next occurrence, soonest first (past one-time dates last). */
export function useDates() {
  const swr = useSWR<DtEventsResponse>("/api/dates", fetcher);
  const today = todayIST();
  const rows: Row[] = (swr.data?.items ?? [])
    .map((ev) => ({ ev, occ: nextOccurrence(ev, today) }))
    .sort((a, b) => Number(a.occ.past) - Number(b.occ.past) || a.occ.daysAway - b.occ.daysAway || a.ev.title.localeCompare(b.ev.title));
  return { ...swr, rows, today };
}

export const TYPE_ICON: Record<DtType, typeof Cake> = {
  birthday: Cake, anniversary: Heart, remembrance: Flower2, festival: Sparkles, other: CalendarDays,
};

/** One colour per type — used for icons, calendar dots and chips. */
export const TYPE_COLOR: Record<DtType, { ink: string; tint: string }> = {
  birthday: { ink: "#b4533d", tint: "#f6e6df" },
  anniversary: { ink: "#a03f63", tint: "#f5e3ea" },
  remembrance: { ink: "#5d6470", tint: "#eaecef" },
  festival: { ink: "#a8741a", tint: "#f6ecd9" },
  other: { ink: "#57519a", tint: "#eceaf3" },
};

export function TypeIcon({ type, size = 36 }: { type: DtType; size?: number }) {
  const Icon = TYPE_ICON[type];
  const c = TYPE_COLOR[type];
  return (
    <span className="flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: size / 3, background: c.tint }}>
      <Icon size={size * 0.47} color={c.ink} strokeWidth={1.9} />
    </span>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600,
        border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`,
        background: on ? "var(--ink)" : "var(--card)",
        color: on ? "#fff" : "var(--ink)",
      }}
    >
      {children}
    </button>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(24,20,30,.45)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="card w-full rounded-b-none sm:rounded-b-[16px]"
        style={{ maxWidth: wide ? 560 : 480, maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ borderBottom: "1px solid var(--line)", background: "var(--card)", zIndex: 1 }}>
          <p className="display" style={{ fontSize: 19 }}>{title}</p>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--faint)" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const inputStyle = { borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14, width: "100%", background: "var(--card)" } as const;
export const labelStyle = { fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const, marginBottom: 6, display: "block" };

export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
