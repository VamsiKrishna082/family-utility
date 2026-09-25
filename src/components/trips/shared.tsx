"use client";

import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import type { TripStatus } from "@/lib/trips/types";

export { Chip, inputStyle, labelStyle, Modal } from "@/components/dates/shared";

export const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: Record<string, unknown>) {
    super(message);
  }
}

export async function send<T = unknown>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(json.error ?? "Something went wrong", r.status, json);
  return json as T;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const paiseToRupees = (p: number) => rupees(p / 100);

export const STATUS_STYLE: Record<TripStatus, { label: string; ink: string; tint: string }> = {
  idea: { label: "Idea", ink: "#57519a", tint: "#eceaf3" },
  upcoming: { label: "Upcoming", ink: "#2f6e6b", tint: "#e5efee" },
  ongoing: { label: "On the trip", ink: "#b4533d", tint: "#f6e6df" },
  completed: { label: "Completed", ink: "#6b6774", tint: "#edeae4" },
};

export function StatusPill({ status }: { status: TripStatus }) {
  const s = STATUS_STYLE[status];
  return <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: s.tint, color: s.ink, whiteSpace: "nowrap" }}>{s.label}</span>;
}

/** Cover image for a trip card / header: the chosen Album photo, else a soft gradient with a plane. */
export function Cover({ photoId, height, radius = 14, children }: { photoId?: string; height: number; radius?: number; children?: ReactNode }) {
  return (
    <div style={{ position: "relative", height, borderRadius: radius, overflow: "hidden", background: "linear-gradient(135deg, #e5efee 0%, #f2ece2 100%)" }}>
      {photoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/thumb/${photoId}?w=1600`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span className="flex items-center justify-center" style={{ position: "absolute", inset: 0 }}>
          <Plane size={height / 4} color="#2f6e6b" strokeWidth={1.4} opacity={0.35} />
        </span>
      )}
      {children}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card mb-5" style={{ padding: 18 }}>
      <div className="flex items-center justify-between mb-3" style={{ gap: 10 }}>
        <p className="display" style={{ fontSize: 19 }}>{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

export const smallBtn = { padding: "6px 10px", fontSize: 12.5 } as const;
