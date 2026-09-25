"use client";

import { useState } from "react";

const BAR = "#1b8a6b"; // validated: lightness band, chroma floor, contrast vs the card surface
const W = 560;
const H = 180;
const PAD = { top: 16, right: 8, bottom: 26, left: 44 };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const short = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${Math.round(n)}`);

/** A round axis maximum (1, 2, 2.5 or 5 × 10ⁿ) at or above the largest value. */
function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v)!;
}

/**
 * Spend per trip day — one series, so no legend (the card title names it).
 * Thin bars with 4px rounded tops on a shared baseline, 2px gaps, a recessive
 * grid, a hover tooltip per bar, and a table view for exact numbers.
 */
export function DailySpendChart({ days }: { days: { label: string; sub: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...days.map((d) => d.value)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / days.length;
  const bw = Math.max(4, Math.min(28, slot - 2));
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD.top + ih - (v / max) * ih;

  if (table) {
    return (
      <div>
        <table style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
          <thead><tr style={{ color: "var(--faint)", textAlign: "left" }}><th style={{ fontWeight: 600, padding: "4px 0" }}>Day</th><th style={{ fontWeight: 600, textAlign: "right" }}>Spent</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.label} style={{ borderTop: "1px solid var(--line2)" }}><td style={{ padding: "5px 0" }}>{d.label} <span style={{ color: "var(--faint)" }}>· {d.sub}</span></td><td style={{ textAlign: "right", fontWeight: 600 }}>{inr(d.value)}</td></tr>)}</tbody>
        </table>
        <button onClick={() => setTable(false)} style={{ fontSize: 12.5, color: "var(--indigo)", fontWeight: 600, marginTop: 8 }}>Show as chart</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Spend per day: ${days.map((d) => `${d.label} ${inr(d.value)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line2)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--faint)">{short(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.left + i * slot + (slot - bw) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h, bw / 2);
          // rounded top, square base on the baseline
          const path = h > 0
            ? `M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + bw - r} Q${x + bw},${y(d.value)} ${x + bw},${y(d.value) + r} V${y(0)} Z`
            : "";
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${inr(d.value)}`}>
              {/* hit target bigger than the mark */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={ih} fill="transparent" />
              {path && <path d={path} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {days.length <= 14 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--faint)">{d.label.replace("Day ", "")}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", pointerEvents: "none", top: 0,
          left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, transform: "translateX(-50%)",
          background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, whiteSpace: "nowrap",
        }}>
          <strong>{days[hover].label}</strong> · {days[hover].sub}<br />{inr(days[hover].value)}
        </div>
      )}
      <button onClick={() => setTable(true)} style={{ fontSize: 12.5, color: "var(--indigo)", fontWeight: 600 }}>Show as table</button>
    </div>
  );
}
