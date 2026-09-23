"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, ChevronRight, Pencil, ShieldCheck, PiggyBank, ClipboardCheck, TrendingUp, CalendarClock } from "lucide-react";
import { formatPaise, formatPaiseExact } from "@/lib/money";
import type { NwDashboardResponse, NwAssetClass, NwAccountRow, NwHeldBy } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load net worth");
  return r.json();
};

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  let year = y;
  let month = m + delta;
  while (month > 12) { month -= 12; year += 1; }
  while (month < 1) { month += 12; year -= 1; }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthKeyLabel(monthKey: string, style: "short" | "long" = "short"): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: style, year: "numeric" });
}

/**
 * Institution and/or gain%, as parts rather than a joined string so callers
 * can prepend held-by only where it's needed. No fallback to the account's
 * kind — that used to print e.g. "Stocks" right under a tile already headed
 * "Stocks", reading as a confusing near-duplicate. Empty is better than
 * that when there's nothing else to say.
 */
function subLabelParts(row: NwAccountRow): string[] {
  const parts: string[] = [];
  if (row.account.institution) parts.push(row.account.institution);
  if (row.account.investedPaise && row.valuePaise) {
    const gainPct = Math.round(((row.valuePaise - row.account.investedPaise) / row.account.investedPaise) * 100);
    parts.push(`${gainPct >= 0 ? "+" : ""}${gainPct}%`);
  }
  return parts;
}

// "Yours"/"Hers" would read backwards for whichever of you isn't the one
// looking — both of you see the identical page, there's no per-viewer
// personalization here — so this uses fixed names instead.
function heldByLabel(heldBy: NwHeldBy): string {
  return heldBy === "joint" ? "Joint" : heldBy === "yours" ? "Vamsi" : "Varshini";
}

/**
 * Same account name, different people (EPF/Stocks/NPS are individual, not
 * joint, so tracking both of you means two separate account documents) —
 * grouped for display only, so "EPF" reads as one thing with a Yours/Hers
 * breakdown instead of two disconnected-looking rows. The underlying
 * accounts and totals math are untouched, this is purely how they're shown.
 */
function groupByName(rows: NwAccountRow[]): { name: string; rows: NwAccountRow[] }[] {
  const map = new Map<string, NwAccountRow[]>();
  for (const row of rows) {
    const list = map.get(row.account.name) ?? [];
    list.push(row);
    map.set(row.account.name, list);
  }
  return [...map.entries()].map(([name, rows]) => ({ name, rows }));
}

function monthsUntil(endDateISO: string): number {
  const [ey, em] = endDateISO.split("-").map(Number);
  const today = new Date();
  return Math.max(0, (ey - today.getFullYear()) * 12 + (em - (today.getMonth() + 1)));
}

const assetClassMeta: Record<NwAssetClass, { label: string; color: string }> = {
  equity: { label: "Equity", color: "var(--indigo)" },
  retirement: { label: "Retirement", color: "var(--green)" },
  cash: { label: "Cash & deposits", color: "var(--amber)" },
  gold: { label: "Gold", color: "#c78a1e" },
  property: { label: "Property", color: "#8a6a32" },
};

export function NetWorthDashboard() {
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const swrKey = `/api/networth${viewMonth ? `?month=${viewMonth}` : ""}`;
  const { data, error, isLoading } = useSWR<NwDashboardResponse>(swrKey, fetcher);

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<Record<string, string>>({});
  const [savingTarget, setSavingTarget] = useState(false);

  function startEditingTarget() {
    const current = data?.settings.targetMix ?? {};
    setTargetDraft(Object.fromEntries((Object.keys(assetClassMeta) as NwAssetClass[]).map((cls) => [cls, String(current[cls] ?? 0)])));
    setEditingTarget(true);
  }

  async function saveTargetMix() {
    setSavingTarget(true);
    try {
      const targetMix = Object.fromEntries(Object.entries(targetDraft).map(([cls, v]) => [cls, Number(v) || 0]));
      const res = await fetch("/api/networth/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMix }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save target mix");
      await mutate(swrKey);
      setEditingTarget(false);
    } finally {
      setSavingTarget(false);
    }
  }

  const displayMonth = viewMonth ?? data?.monthKey ?? null;

  if (error) {
    return <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>;
  }
  if (!data && isLoading) {
    return <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>;
  }
  if (!data) return null;

  const { snapshot, prevSnapshot, trend, accountRows, emergencyCoverMonths } = data;
  const momChangePaise = prevSnapshot ? snapshot.totals.netPaise - prevSnapshot.totals.netPaise : null;
  const momChangePct = prevSnapshot && prevSnapshot.totals.netPaise !== 0
    ? Math.round((momChangePaise! / Math.abs(prevSnapshot.totals.netPaise)) * 100)
    : null;
  const oldestPoint = trend[0];
  const twelveMoChangePaise = oldestPoint?.hasData ? snapshot.totals.netPaise - oldestPoint.netPaise : null;

  const assetAccounts = accountRows.filter((r) => r.account.kind !== "loan");
  const loanAccounts = accountRows.filter((r) => r.account.kind === "loan");
  const prevLiabilities = prevSnapshot?.totals.liabilitiesPaise ?? snapshot.totals.liabilitiesPaise;
  const liabilitiesReduction = prevLiabilities - snapshot.totals.liabilitiesPaise;

  const totalAllocated = Object.values(snapshot.totals.byAssetClass).reduce((s, v) => s + v, 0);
  const maxTrendAbs = Math.max(1, ...trend.map((t) => Math.abs(t.netPaise)), ...trend.map((t) => t.liabilitiesPaise));

  // "Growth from markets" (networth.md's own definition): the part of this
  // month's asset change that isn't money you actually put in — i.e. total
  // asset movement minus what Money recorded as saved this month. Both
  // numbers are already loaded, no extra reads.
  const assetChangePaise = prevSnapshot ? snapshot.totals.assetsPaise - prevSnapshot.totals.assetsPaise : null;
  const growthFromMarketsPaise = assetChangePaise !== null && data.savedThisMonthPaise !== null
    ? assetChangePaise - data.savedThisMonthPaise
    : null;

  // Latest of every loan's own endDate — already stored per loan, just needs finding the max.
  const loanEndDates = loanAccounts.map((r) => r.account.loan?.endDate).filter((d): d is string => Boolean(d));
  const debtFreeDate = loanEndDates.length > 0 ? loanEndDates.sort().at(-1)! : null;

  return (
    <div>
      <div className="flex items-start gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <Link href="/" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1" style={{ minWidth: 160 }}>
          <h1 className="display" style={{ fontSize: 30 }}>Net worth</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>What you own, minus what you owe — updated monthly, not live.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: "auto" }}>
          <div className="flex items-center gap-1 card" style={{ padding: "6px 10px" }}>
            <button aria-label="Previous month" onClick={() => setViewMonth(shiftMonthKey(displayMonth!, -1))}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 92, textAlign: "center" }}>{displayMonth ? monthKeyLabel(displayMonth) : ""}</span>
            <button aria-label="Next month" onClick={() => setViewMonth(shiftMonthKey(displayMonth!, 1))}><ChevronRight size={16} /></button>
          </div>
          <Link href={`/worth/update?month=${data.monthKey}`} className="btn btn-dark flex items-center gap-1.5">
            <Pencil size={14} /> <span className="hidden sm:inline">Update balances</span>
          </Link>
        </div>
      </div>

      {/* Top strip */}
      <div className="mb-8" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div className="card" style={{ padding: 20, background: "var(--ink)", color: "#fff" }}>
          <p style={{ color: "rgba(255,255,255,.6)", fontSize: 12.5 }}>Net worth</p>
          <p className="display" style={{ fontSize: 26, marginTop: 6 }}>{formatPaise(snapshot.totals.netPaise)}</p>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)", marginTop: 6 }}>
            {momChangePaise !== null && `${momChangePaise >= 0 ? "+" : ""}${formatPaise(momChangePaise)}${momChangePct !== null ? ` (${momChangePct >= 0 ? "+" : ""}${momChangePct}%)` : ""} this month`}
            {momChangePaise !== null && twelveMoChangePaise !== null && " · "}
            {twelveMoChangePaise !== null && `${twelveMoChangePaise >= 0 ? "+" : ""}${formatPaise(twelveMoChangePaise)} / 12mo`}
          </p>
          {data.pendingAccounts.length > 0 && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 3 }}>
              carried forward — {data.pendingAccounts.length} account{data.pendingAccounts.length === 1 ? "" : "s"} not yet updated
            </p>
          )}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Assets</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--green)" }}>{formatPaise(snapshot.totals.assetsPaise)}</p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>{assetAccounts.length} account{assetAccounts.length === 1 ? "" : "s"}</p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Liabilities</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--red)" }}>{formatPaise(snapshot.totals.liabilitiesPaise)}</p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
            {loanAccounts.length} loan{loanAccounts.length === 1 ? "" : "s"}
            {liabilitiesReduction !== 0 && ` · ${liabilitiesReduction > 0 ? "-" : "+"}${formatPaise(Math.abs(liabilitiesReduction))} this month`}
          </p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <p className="flex items-center gap-1.5" style={{ color: "var(--faint)", fontSize: 12.5 }}><ShieldCheck size={13} /> Emergency cover</p>
          <p className="display" style={{ fontSize: 22, marginTop: 6 }}>
            {emergencyCoverMonths !== null ? `${emergencyCoverMonths.toFixed(1)} mo` : "—"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
            {emergencyCoverMonths !== null ? "liquid ÷ avg. monthly spend" : "no spending history yet"}
          </p>
        </div>
      </div>

      {/* Trend + Allocation */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Last 12 months</p>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {trend.map((t) => {
              const netH = t.hasData ? Math.max(2, (Math.abs(t.netPaise) / maxTrendAbs) * 100) : 0;
              const liabH = t.hasData ? Math.max(0, (t.liabilitiesPaise / maxTrendAbs) * 100) : 0;
              return (
                <button
                  key={t.monthKey}
                  onClick={() => t.hasData && setViewMonth(t.monthKey)}
                  className="flex-1 flex flex-col items-center justify-end"
                  style={{ height: "100%", opacity: t.hasData ? 1 : 0.3 }}
                  disabled={!t.hasData}
                  title={monthKeyLabel(t.monthKey, "long")}
                >
                  {t.hasData && (
                    <span style={{ fontSize: 9.5, color: "var(--faint)", marginBottom: 3, writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: 40 }}>
                      {formatPaise(t.netPaise)}
                    </span>
                  )}
                  <div style={{ width: "100%", height: `${netH}%`, background: t.monthKey === data.monthKey ? "var(--indigo)" : "var(--line2)", borderRadius: "4px 4px 0 0" }} />
                  <div style={{ width: "100%", height: `${liabH}%`, background: "#e8c9c5", marginTop: 1 }} />
                  <span style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 4 }}>{monthKeyLabel(t.monthKey).slice(0, 3)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Allocation</p>
            {!editingTarget && (
              <button onClick={startEditingTarget} className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--faint)" }}>
                <Pencil size={12} /> {data.settings.targetMix ? "Edit target" : "Set target"}
              </button>
            )}
          </div>

          {editingTarget ? (
            <div>
              {(Object.keys(assetClassMeta) as NwAssetClass[]).map((cls) => (
                <div key={cls} className="flex items-center justify-between gap-2" style={{ fontSize: 13, marginBottom: 8 }}>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: assetClassMeta[cls].color }} />
                    {assetClassMeta[cls].label}
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={targetDraft[cls] ?? ""}
                      onChange={(e) => setTargetDraft((d) => ({ ...d, [cls]: e.target.value }))}
                      style={{ width: 56, textAlign: "right", fontSize: 13, padding: "3px 6px" }}
                      className="card"
                    />
                    <span style={{ color: "var(--faint)" }}>%</span>
                  </span>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 10 }}>
                Total: {Object.values(targetDraft).reduce((s, v) => s + (Number(v) || 0), 0)}%
              </p>
              <div className="flex gap-2">
                <button className="btn btn-dark" onClick={saveTargetMix} disabled={savingTarget} style={{ fontSize: 13, padding: "6px 14px" }}>
                  {savingTarget ? "Saving…" : "Save target"}
                </button>
                <button onClick={() => setEditingTarget(false)} style={{ fontSize: 13, padding: "6px 14px", color: "var(--faint)" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : totalAllocated === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 14 }}>No asset values yet.</p>
          ) : (
            <>
              <div className="flex" style={{ height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
                {(Object.keys(assetClassMeta) as NwAssetClass[]).map((cls) => {
                  const v = snapshot.totals.byAssetClass[cls] ?? 0;
                  if (v === 0) return null;
                  return <div key={cls} style={{ width: `${(v / totalAllocated) * 100}%`, background: assetClassMeta[cls].color }} />;
                })}
              </div>
              {(Object.keys(assetClassMeta) as NwAssetClass[]).map((cls) => {
                const v = snapshot.totals.byAssetClass[cls] ?? 0;
                if (v === 0 && !data.settings.targetMix?.[cls]) return null;
                const actualPct = Math.round((v / totalAllocated) * 100);
                const targetPct = data.settings.targetMix?.[cls];
                const drift = targetPct !== undefined ? actualPct - targetPct : null;
                return (
                  <div key={cls} className="flex items-center justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span className="flex items-center gap-2">
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: assetClassMeta[cls].color }} />
                      {assetClassMeta[cls].label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span style={{ color: "var(--dim)", fontWeight: 600 }}>{formatPaiseExact(v)}</span>
                      <span style={{ color: "var(--faint)", width: 34, textAlign: "right" }}>{actualPct}%</span>
                      {drift !== null && Math.abs(drift) >= 1 && (
                        <span style={{ fontSize: 11, color: drift > 0 ? "var(--indigo)" : "var(--red)", width: 34, textAlign: "right" }}>
                          {drift > 0 ? "+" : ""}{drift}%
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Accounts + Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Accounts</p>
          {assetAccounts.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 14 }}>No accounts yet — add one from Update balances.</p>
          ) : (
            groupByName(assetAccounts).map((group, i) => {
              const border = { borderTop: i === 0 ? "none" : "1px solid var(--line2)" };
              if (group.rows.length === 1) {
                const row = group.rows[0];
                // Held-by folded into the same sub-label line as institution
                // and gain% — one consistent place for secondary info below
                // the title, instead of a separate column that only a group
                // sub-row actually needs (there, the holder name *is* the
                // row's own label, since the heading above already carries
                // the shared account name).
                const label = [heldByLabel(row.account.heldBy), ...subLabelParts(row)].join(" · ");
                const status = row.isStale
                  ? `as of ${monthKeyLabel(row.valueMonthKey!)}`
                  : row.changeThisMonthPaise !== null
                    ? `${row.changeThisMonthPaise >= 0 ? "+" : ""}${formatPaiseExact(row.changeThisMonthPaise)}`
                    : null;
                return (
                  <div key={row.account.id} className="flex items-center gap-3 py-2.5" style={border}>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 14 }}>{row.account.name}</p>
                      <p className="truncate" style={{ fontSize: 11.5, color: "var(--faint)" }}>{label}</p>
                    </div>
                    {row.account.assetClass === "gold" && (
                      <Link href="/worth/gold" style={{ fontSize: 11.5, color: "var(--indigo)", flexShrink: 0 }}>Items →</Link>
                    )}
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{row.valuePaise !== null ? formatPaiseExact(row.valuePaise) : "—"}</p>
                      {status && <p style={{ fontSize: 11, color: row.isStale ? "var(--amber)" : "var(--faint)" }}>{status}</p>}
                    </div>
                  </div>
                );
              }
              // Same name, multiple holders (e.g. "EPF" — Vamsi and Varshini
              // separately, since EPF/NPS/stocks are individual accounts, not
              // joint) — one shared heading with the combined total, then a
              // sub-row per holder instead of two disconnected-looking rows.
              const combinedPaise = group.rows.reduce((s, r) => s + (r.valuePaise ?? 0), 0);
              return (
                <div key={group.name} className="py-2.5" style={border}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p style={{ fontSize: 14 }}>{group.name}</p>
                    <div className="flex items-center gap-2">
                      {group.rows[0].account.assetClass === "gold" && (
                        <Link href="/worth/gold" style={{ fontSize: 11.5, color: "var(--indigo)" }}>Items →</Link>
                      )}
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)" }}>{formatPaiseExact(combinedPaise)}</p>
                    </div>
                  </div>
                  {group.rows.map((row) => {
                    const label = subLabelParts(row).join(" · ");
                    return (
                      <div key={row.account.id} className="flex items-center gap-3" style={{ paddingLeft: 4, paddingTop: 4 }}>
                        <span style={{ fontSize: 12.5, color: "var(--dim)", width: 56, flexShrink: 0 }}>{heldByLabel(row.account.heldBy)}</span>
                        {label && <span className="truncate flex-1" style={{ fontSize: 11.5, color: "var(--faint)" }}>{label}</span>}
                        <span className={label ? undefined : "flex-1"} style={{ fontSize: 13.5, fontWeight: 600, textAlign: label ? undefined : "right" }}>
                          {row.valuePaise !== null ? formatPaiseExact(row.valuePaise) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Loans</p>
          {loanAccounts.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 14 }}>No loans on record.</p>
          ) : (
            loanAccounts.map((row, i) => (
              <div key={row.account.id} className="mb-4 last:mb-0" style={{ paddingTop: i === 0 ? 0 : 12, borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
                <div className="flex justify-between" style={{ fontSize: 13.5, marginBottom: 4 }}>
                  <span>{row.account.name}</span>
                  <span style={{ fontWeight: 600 }}>{row.valuePaise !== null ? formatPaiseExact(row.valuePaise) : "—"}</span>
                </div>
                {row.account.loan && (
                  <p style={{ fontSize: 11.5, color: "var(--faint)" }}>
                    EMI {formatPaiseExact(row.account.loan.emiPaise)} · {row.account.loan.ratePct}% · {monthsUntil(row.account.loan.endDate)} mo left
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* This month's checklist */}
      <div className="card mt-8" style={{ padding: 20, border: "1px dashed var(--line)" }}>
        <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          <ClipboardCheck size={15} color="var(--faint)" /> Have you updated everything this month?
        </p>
        <p style={{ fontSize: 13.5, color: "var(--dim)", marginBottom: data.pendingAccounts.length > 0 ? 10 : 0 }}>
          {data.pendingAccounts.length === 0 && accountRows.length > 0
            ? `Yes — all ${accountRows.length} accounts are current for ${monthKeyLabel(data.monthKey)}.`
            : `${accountRows.length - data.pendingAccounts.length} of ${accountRows.length} accounts entered. These still show an older month's value:`}
        </p>
        {data.pendingAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.pendingAccounts.map((a) => (
              <Link
                key={a.id}
                href={`/worth/update?month=${data.monthKey}`}
                className="card"
                style={{ padding: "6px 10px", fontSize: 12.5, color: "var(--ink)" }}
              >
                {a.name} — enter value
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Insight strip */}
      <div className="mt-8" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div className="card" style={{ padding: 20 }}>
          <p className="flex items-center gap-2" style={{ color: "var(--faint)", fontSize: 12.5 }}>
            <PiggyBank size={13} /> Saved this month
          </p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: "var(--indigo)" }}>
            {data.savedThisMonthPaise !== null ? formatPaise(data.savedThisMonthPaise) : "—"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>from the Money section</p>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <p className="flex items-center gap-2" style={{ color: "var(--faint)", fontSize: 12.5 }}>
            <TrendingUp size={13} /> Growth from markets
          </p>
          <p className="display" style={{ fontSize: 22, marginTop: 6, color: growthFromMarketsPaise !== null && growthFromMarketsPaise < 0 ? "var(--red)" : "var(--green)" }}>
            {growthFromMarketsPaise !== null ? `${growthFromMarketsPaise >= 0 ? "+" : ""}${formatPaise(growthFromMarketsPaise)}` : "—"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
            {growthFromMarketsPaise !== null ? "value change minus new savings" : "need last month's snapshot"}
          </p>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <p className="flex items-center gap-2" style={{ color: "var(--faint)", fontSize: 12.5 }}>
            <CalendarClock size={13} /> Debt-free
          </p>
          <p className="display" style={{ fontSize: 22, marginTop: 6 }}>
            {debtFreeDate ? new Date(`${debtFreeDate}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—"}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
            {debtFreeDate ? "at your current EMIs" : "no loans on record"}
          </p>
        </div>
      </div>
    </div>
  );
}
