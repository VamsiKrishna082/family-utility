"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Plus, Settings, Archive, ArchiveRestore, Sparkles, Trash2 } from "lucide-react";
import { formatPaiseExact, parseRupeesToPaise } from "@/lib/money";
import { NW_ACCOUNT_KINDS, NW_ASSET_CLASSES, NW_HELD_BY, type MoneyGoalsResponse, type NwAccount, type NwAccountsResponse, type NwHeldBy, type NwUpdateResponse, type NwUpdateRow } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

function monthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// Same reasoning as NetWorthDashboard.tsx: both of you see the identical
// page, so "Yours"/"Hers" would read backwards for one of you — fixed names instead.
function heldByLabel(heldBy: NwHeldBy): string {
  return heldBy === "joint" ? "Joint" : heldBy === "yours" ? "Vamsi" : "Varshini";
}

/** Same grouping as the dashboard's accounts table — "EPF" shown once, Yours/Hers as sub-rows, each still independently editable. */
function groupByName(rows: NwUpdateRow[]): { name: string; rows: NwUpdateRow[] }[] {
  const map = new Map<string, NwUpdateRow[]>();
  for (const row of rows) {
    const list = map.get(row.account.name) ?? [];
    list.push(row);
    map.set(row.account.name, list);
  }
  return [...map.entries()].map(([name, rows]) => ({ name, rows }));
}

export function NetWorthUpdateForm({ initialMonth }: { initialMonth: string | null }) {
  const key = `/api/networth/update${initialMonth ? `?month=${initialMonth}` : ""}`;
  const { data, mutate, isLoading } = useSWR<NwUpdateResponse>(key, fetcher);
  const { data: accountsData, mutate: mutateAccounts } = useSWR<NwAccountsResponse>("/api/networth/accounts", fetcher);
  const { data: goalsData } = useSWR<MoneyGoalsResponse>("/api/money/goals", fetcher);
  const goals = goalsData?.items ?? [];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addingAccount, setAddingAccount] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const archivedAccounts = (accountsData?.items ?? []).filter((a) => a.archived);

  const patchAccount = async (id: string, patch: Partial<NwAccount>) => {
    await fetch(`/api/networth/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await Promise.all([mutate(), mutateAccounts()]);
  };

  const deleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" permanently? This can't be undone — if you just want it out of the way, use Archive instead.`)) return;
    await fetch(`/api/networth/accounts/${id}`, { method: "DELETE" });
    await Promise.all([mutate(), mutateAccounts()]);
  };

  const rows = data?.rows ?? [];

  const valueFor = (accountId: string, fallback: number | null) =>
    drafts[accountId] !== undefined ? drafts[accountId] : fallback !== null ? String(fallback / 100) : "";

  const runningTotalPaise = useMemo(() => {
    return rows.reduce((sum, row) => {
      const raw = valueFor(row.account.id, row.currentValuePaise);
      const paise = parseRupeesToPaise(raw) ?? 0;
      return row.account.kind === "loan" ? sum - paise : sum + paise;
    }, 0);
  }, [rows, drafts]);

  const save = async () => {
    if (!data) return;
    const body: Record<string, number> = {};
    for (const row of rows) {
      const raw = drafts[row.account.id];
      if (raw === undefined) continue; // untouched — leave whatever's already saved alone
      const paise = parseRupeesToPaise(raw);
      if (paise !== null) body[row.account.id] = paise;
    }
    if (Object.keys(body).length === 0) return;
    setSaving(true);
    try {
      await fetch(`/api/networth/snapshots/${data.monthKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDrafts({});
      setSaved(true);
      await mutate();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/worth" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30 }}>Update balances</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {data ? monthKeyLabel(data.monthKey) : ""} · last month's values shown as a hint
          </p>
        </div>
      </div>

      {isLoading && !data ? (
        <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
      ) : (
        <>
          <div className="card" style={{ padding: 8 }}>
            {groupByName(rows).map((group, i) => (
              <div key={group.name} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }} className="py-1">
                {group.rows.length > 1 && (
                  <p className="px-3 pt-2" style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 600 }}>{group.name}</p>
                )}
                {group.rows.map((row) => (
                  <div key={row.account.id}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0" style={{ paddingLeft: group.rows.length > 1 ? 8 : 0 }}>
                        <p className="truncate" style={{ fontSize: 14 }}>{group.rows.length > 1 ? heldByLabel(row.account.heldBy) : row.account.name}</p>
                        {row.previousValuePaise !== null && (
                          <p style={{ fontSize: 11.5, color: "var(--faint)" }}>Last month: {formatPaiseExact(row.previousValuePaise)}</p>
                        )}
                      </div>
                      {row.autoSource ? (
                        <div className="flex items-center gap-2" title="Filled in automatically — no need to type it">
                          <span className="hidden sm:flex items-center gap-1" style={{ fontSize: 12, color: "var(--indigo)", fontWeight: 600 }}>
                            <Sparkles size={12} />
                            Auto · {row.autoSource === "money_goal"
                              ? goals.find((g) => g.id === row.account.linkedToMoneyGoalId)?.name ?? "Money goal"
                              : row.autoSource === "gold_items"
                                ? "today's gold rate"
                                : "Money's left"}
                          </span>
                          <span style={{ width: 130, padding: "8px 10px", fontSize: 14, textAlign: "right", fontWeight: 600, borderRadius: 10, background: "var(--line2)" }}>
                            {formatPaiseExact(row.autoValuePaise ?? 0)}
                          </span>
                        </div>
                      ) : (
                        <>
                          {row.previousValuePaise !== null && (
                            <button
                              className="btn btn-plain hidden sm:block"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                              onClick={() => setDrafts((d) => ({ ...d, [row.account.id]: String(row.previousValuePaise! / 100) }))}
                            >
                              Same as last month
                            </button>
                          )}
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="₹0"
                            value={valueFor(row.account.id, row.currentValuePaise)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [row.account.id]: e.target.value }))}
                            style={{ width: 130, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 14, textAlign: "right" }}
                          />
                        </>
                      )}
                      <button
                        aria-label="Account settings"
                        onClick={() => setExpandedId(expandedId === row.account.id ? null : row.account.id)}
                        style={{ color: "var(--faint)", padding: 4 }}
                      >
                        <Settings size={15} />
                      </button>
                    </div>

                    {expandedId === row.account.id && (
                      <div className="flex items-center gap-3 px-3 pb-3" style={{ flexWrap: "wrap", paddingLeft: group.rows.length > 1 ? 20 : 12 }}>
                        <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: "var(--dim)" }}>
                          Fill automatically from
                          <select
                            value={row.account.linkedToMoneyLeftover ? "leftover" : row.account.linkedToMoneyGoalId ? `goal:${row.account.linkedToMoneyGoalId}` : "none"}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "leftover") patchAccount(row.account.id, { linkedToMoneyLeftover: true, linkedToMoneyGoalId: undefined });
                              else if (v.startsWith("goal:")) patchAccount(row.account.id, { linkedToMoneyLeftover: false, linkedToMoneyGoalId: v.slice(5) });
                              else patchAccount(row.account.id, { linkedToMoneyLeftover: false, linkedToMoneyGoalId: undefined });
                            }}
                            style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "4px 8px", fontSize: 12.5 }}
                          >
                            <option value="none">Nothing — enter by hand</option>
                            <option value="leftover">Money's left-to-spend</option>
                            {goals.map((g) => <option key={g.id} value={`goal:${g.id}`}>Money goal: {g.name}</option>)}
                          </select>
                        </label>
                        <div className="flex gap-2" style={{ marginLeft: "auto" }}>
                          <button
                            className="btn btn-plain flex items-center gap-1.5"
                            style={{ padding: "5px 10px", fontSize: 12 }}
                            onClick={() => patchAccount(row.account.id, { archived: true })}
                          >
                            <Archive size={12} /> Archive
                          </button>
                          <button
                            className="btn btn-plain flex items-center gap-1.5"
                            style={{ padding: "5px 10px", fontSize: 12, color: "var(--red)" }}
                            onClick={() => deleteAccount(row.account.id, row.account.name)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {archivedAccounts.length > 0 && (
            <div className="card mt-4" style={{ padding: 12 }}>
              <p style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 600, marginBottom: 8 }}>Archived</p>
              {archivedAccounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between" style={{ padding: "6px 0", fontSize: 13.5 }}>
                  <span className="truncate">{a.name}</span>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-plain flex items-center gap-1.5"
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      onClick={() => patchAccount(a.id, { archived: false })}
                    >
                      <ArchiveRestore size={12} /> Unarchive
                    </button>
                    <button
                      className="btn btn-plain flex items-center gap-1.5"
                      style={{ padding: "5px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => deleteAccount(a.id, a.name)}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!addingAccount ? (
            <button onClick={() => setAddingAccount(true)} className="flex items-center gap-1.5 mt-4" style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>
              <Plus size={14} /> New account
            </button>
          ) : (
            <NewAccountForm onDone={() => { setAddingAccount(false); mutate(); }} onCancel={() => setAddingAccount(false)} />
          )}

          <div className="card flex items-center justify-between mt-6" style={{ padding: 16, position: "sticky", bottom: 16 }}>
            <div>
              <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Running total</p>
              <p className="display" style={{ fontSize: 20 }}>{formatPaiseExact(runningTotalPaise)}</p>
            </div>
            <button className="btn btn-dark" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NewAccountForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof NW_ACCOUNT_KINDS)[number]>("bank");
  const [assetClass, setAssetClass] = useState<(typeof NW_ASSET_CLASSES)[number]>("cash");
  const [institution, setInstitution] = useState("");
  const [heldBy, setHeldBy] = useState<(typeof NW_HELD_BY)[number]>("joint");
  const [addForBoth, setAddForBoth] = useState(false);
  const [liquid, setLiquid] = useState(false);
  const [emi, setEmi] = useState("");
  const [rate, setRate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const isLoan = kind === "loan";

  const createOne = (heldByValue: NwHeldBy) => {
    const body: Record<string, unknown> = { name: name.trim(), kind, institution: institution.trim() || undefined, heldBy: heldByValue, liquid };
    if (isLoan) body.loan = { emiPaise: parseRupeesToPaise(emi), ratePct: Number(rate), endDate };
    else body.assetClass = assetClass;
    return fetch("/api/networth/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  };

  const save = async () => {
    if (!name.trim()) return;
    if (isLoan) {
      const emiPaise = parseRupeesToPaise(emi);
      const ratePct = Number(rate);
      if (!emiPaise || !ratePct || !endDate) return;
    }
    setSaving(true);
    try {
      // EPF/NPS/stocks are individual, not joint — this is the common case
      // for exactly those, so one tap creates both instead of running the
      // form twice. They land as two accounts under the same name, which
      // the accounts table and update form already group together.
      if (addForBoth) await Promise.all([createOne("yours"), createOne("hers")]);
      else await createOne(heldBy);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mt-3" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text" placeholder="Name, e.g. HDFC savings" value={name} onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, minWidth: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
          {NW_ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text" placeholder="Institution (optional)" value={institution} onChange={(e) => setInstitution(e.target.value)}
          style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
        />
        {!addForBoth && (
          <select value={heldBy} onChange={(e) => setHeldBy(e.target.value as typeof heldBy)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
            {NW_HELD_BY.map((h) => <option key={h} value={h}>{heldByLabel(h)}</option>)}
          </select>
        )}
        {!isLoan && (
          <select value={assetClass} onChange={(e) => setAssetClass(e.target.value as typeof assetClass)} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
            {NW_ASSET_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={addForBoth} onChange={(e) => setAddForBoth(e.target.checked)} />
        Add one for Vamsi and one for Varshini (e.g. EPF, NPS, individual stocks)
      </label>
      {!isLoan && (
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          <input type="checkbox" checked={liquid} onChange={(e) => setLiquid(e.target.checked)} />
          Liquid (counts toward emergency cover)
        </label>
      )}
      {isLoan && (
        <div className="flex gap-2 flex-wrap">
          <input
            type="number" inputMode="decimal" placeholder="₹ EMI" value={emi} onChange={(e) => setEmi(e.target.value)}
            style={{ width: 110, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
          />
          <input
            type="number" inputMode="decimal" placeholder="Rate %" value={rate} onChange={(e) => setRate(e.target.value)}
            style={{ width: 90, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
          />
          <input
            type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-plain flex-1" style={{ fontSize: 13, padding: "7px 10px" }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-dark flex-1" style={{ fontSize: 13, padding: "7px 10px" }} onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add account"}
        </button>
      </div>
    </div>
  );
}
