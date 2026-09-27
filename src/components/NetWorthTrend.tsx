"use client";

import { useState } from "react";
import useSWR from "swr";
import { fyEndMonth, pace, project, projectionAt, shiftMonth, type NwPoint } from "@/lib/nwTrend";

type Point = NwPoint & { assetsPaise: number; liabilitiesPaise: number };
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const LINE = "#1b8a6b"; // validated chart colour (see dataviz palette check)
const label = (mk: string, long = false) => new Date(`${mk}-01T00:00:00`).toLocaleDateString("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit" });
function lakh(paise: number): string {
  const r = paise / 100;
  const a = Math.abs(r);
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(1)} L` : `${Math.round(a / 1000)}k`;
  return `${r < 0 ? "−" : ""}₹${s}`;
}
const full = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/**
 * Net worth over time — every month you've recorded — with a dashed "at
 * this pace" line six months on and a one-line summary. The pace is the
 * average monthly change over the last few months; it's a straight line,
 * not a market forecast.
 */
export function NetWorthTrend() {
  const { data } = useSWR<{ points: Point[] }>("/api/networth/history", fetcher);
  const [hover, setHover] = useState<number | null>(null);
  const points = data?.points ?? [];
  if (!data) return <div className="card mb-8" style={{ height: 260 }} />;
  if (points.length < 2) {
    return (
      <div className="card mb-8" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>Trend &amp; projection</p>
        <p style={{ fontSize: 13.5, color: "var(--faint)", marginTop: 6 }}>Update balances in at least two months to see how your net worth is moving and where it’s heading.</p>
      </div>
    );
  }

  const p = pace(points)!;
  const proj = project(points, 6);
  const fyEnd = fyEndMonth(points.at(-1)!.monthKey);
  const atFyEnd = projectionAt(points, fyEnd);
  const inYear = projectionAt(points, shiftMonth(points.at(-1)!.monthKey, 12));

  // Chart geometry (viewBox units; scales to the card width).
  const all = [...points.map((x) => x.netPaise), ...proj.map((x) => x.netPaise), 0];
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = lo - pad, yMax = hi + pad;
  const W = 640, H = 200, L = 8, R = 8, T = 10, B = 24;
  const n = points.length + proj.length - 1;
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const path = (vals: number[], offset = 0) => vals.map((v, i) => `${i ? "L" : "M"}${x(i + offset).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const grid = [0, 0.5, 1].map((f) => yMin + (yMax - yMin) * f);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="card mb-8" style={{ padding: 20 }}>
      <div className="flex items-baseline justify-between" style={{ gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>Trend &amp; projection</p>
        <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{label(points[0].monthKey, true)} – {label(points.at(-1)!.monthKey, true)}</p>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--dim)", marginTop: 6 }}>
        {p.perMonthPaise >= 0 ? "Growing" : "Shrinking"} about <b style={{ color: "var(--ink)" }}>{full(Math.abs(p.perMonthPaise))} a month</b> over the last {p.months} month{p.months === 1 ? "" : "s"}.
        {atFyEnd !== null && <> At this pace: <b style={{ color: "var(--ink)" }}>{lakh(atFyEnd)}</b> by {label(fyEnd, true)}</>}
        {inYear !== null && <> and <b style={{ color: "var(--ink)" }}>{lakh(inYear)}</b> a year from now.</>}
      </p>

      <div style={{ position: "relative", marginTop: 12 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Net worth by month, ${lakh(points[0].netPaise)} to ${lakh(points.at(-1)!.netPaise)}`} onMouseLeave={() => setHover(null)} style={{ display: "block", overflow: "visible" }}>
          {grid.map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--line2)" strokeWidth={1} />
              <text x={L} y={y(g) - 4} fontSize={10} fill="var(--faint)">{lakh(g)}</text>
            </g>
          ))}
          <path d={path(proj.map((q) => q.netPaise), points.length - 1)} fill="none" stroke={LINE} strokeWidth={2} strokeDasharray="5 5" opacity={0.6} />
          <text x={x(n - 1)} y={y(proj.at(-1)!.netPaise) - 8} fontSize={10.5} fill="var(--dim)" textAnchor="end">at this pace</text>
          <path d={path(points.map((q) => q.netPaise))} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((q, i) => (
            <g key={q.monthKey}>
              <circle cx={x(i)} cy={y(q.netPaise)} r={hover === i ? 5 : 3.5} fill={LINE} stroke="var(--card)" strokeWidth={2} />
              {/* big invisible target so hovering is easy */}
              <rect x={x(i) - 14} y={T} width={28} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              {i % labelEvery === 0 && <text x={x(i)} y={H - 6} fontSize={10} fill="var(--faint)" textAnchor="middle">{label(q.monthKey)}</text>}
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line)" strokeWidth={1} />}
        </svg>
        {h && (
          <div className="card" style={{ position: "absolute", top: 0, left: `${Math.min(70, Math.max(0, (x(hover!) / W) * 100 - 12))}%`, padding: "8px 10px", fontSize: 12.5, pointerEvents: "none", boxShadow: "0 4px 14px rgba(0,0,0,.08)" }}>
            <p style={{ fontWeight: 700 }}>{label(h.monthKey, true)}</p>
            <p>Net worth {full(h.netPaise)}</p>
            <p style={{ color: "var(--faint)" }}>Assets {full(h.assetsPaise)} · Loans {full(h.liabilitiesPaise)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
