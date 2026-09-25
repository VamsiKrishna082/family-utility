"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Link2, Plus, Search, X } from "lucide-react";
import { dateOfDay, dayLabel, daysBetween, phaseOf, settleUp, todayIST, type Phase } from "@/lib/trips/logic";
import { BUDGET_KEYS, BUDGET_LABEL, type BudgetKey, type SharedCost, type Trip, type TripCandidatesResponse, type TripExpense, type TripExpensesResponse } from "@/lib/trips/types";
import type { MoneyCategoriesResponse } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";
import { Chip, fetcher, inputStyle, labelStyle, Modal, paiseToRupees, rupees, Section, send, smallBtn, uid } from "@/components/trips/shared";

const PHASE_LABEL: Record<Phase, string> = { before: "Before the trip — bookings & shopping", during: "During the trip", after: "After" };

/** Maps a Money category onto the trip's budget-plan buckets (Transport → travel, Stays → stay, …). */
function bucketOf(e: TripExpense): BudgetKey {
  const g = `${e.categoryGroup} ${e.categoryName}`.toLowerCase();
  if (/stay|hotel|homestay|resort|airbnb/.test(g)) return "stay";
  if (/transport|fuel|cab|auto|metro|flight|train|bus|travel|trip|parking|toll/.test(g)) return "travel";
  if (/food|dining|restaurant|snack|grocer/.test(g)) return "food";
  if (/shopping|clothing|electronics|gift/.test(g)) return "shopping";
  if (/fun|movie|outing|hobb|activity|ticket/.test(g)) return "activities";
  return "other";
}

function LinkExisting({ trip, onClose, onDone }: { trip: Trip; onClose: () => void; onDone: () => void }) {
  const { data } = useSWR<TripCandidatesResponse>(`/api/trips/${trip.id}/candidates`, fetcher);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const needle = q.trim().toLowerCase();
  const items = (data?.items ?? []).filter((e) => !needle || `${e.categoryName} ${e.subcategory ?? ""} ${e.note}`.toLowerCase().includes(needle));
  const total = items.filter((e) => picked.has(e.id)).reduce((s, e) => s + e.amountPaise, 0);

  const link = async () => {
    setBusy(true);
    try {
      await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: [...picked], link: true });
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Link expenses from Money" onClose={onClose} wide>
      <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 10 }}>
        Expenses from {data?.from ? dayLabel(data.from) : "3 months before"} to {data?.to ? dayLabel(data.to) : "a month after"} — bookings and shopping often happen weeks early. Linking doesn&apos;t change them in Money.
      </p>
      <div className="flex items-center gap-2 mb-2" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px" }}>
        <Search size={14} color="var(--faint)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search category or note" className="flex-1 outline-none" style={{ fontSize: 14, background: "transparent" }} aria-label="Search expenses" />
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {!data && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>Loading…</p>}
        {data && items.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>No other expenses in that window.</p>}
        {items.map((e) => {
          const on = picked.has(e.id);
          return (
            <label key={e.id} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--line2)", cursor: "pointer" }}>
              <input type="checkbox" checked={on} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} style={{ width: 17, height: 17 }} />
              <span style={{ width: 70, fontSize: 12.5, color: "var(--faint)", flexShrink: 0 }}>{dayLabel(e.date).replace(/^\w+, /, "")}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 14 }}>{[e.categoryName, e.subcategory].filter(Boolean).join(" · ")}</span>
                <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>{e.note}{e.otherTripId ? " · on another trip (will move here)" : ""}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(e.amountPaise)}</span>
            </label>
          );
        })}
      </div>
      <button className="btn btn-dark w-full mt-3" disabled={!picked.size || busy} onClick={link}>
        {busy ? "Linking…" : picked.size ? `Link ${picked.size} expense${picked.size === 1 ? "" : "s"} · ${paiseToRupees(total)}` : "Pick expenses to link"}
      </button>
    </Modal>
  );
}

function SharedCostForm({ trip, editing, onClose, onSave, onDelete }: { trip: Trip; editing?: SharedCost; onClose: () => void; onSave: (c: SharedCost) => void; onDelete?: () => void }) {
  const people = trip.travellers.length ? trip.travellers : ["Us"];
  const [title, setTitle] = useState(editing?.title ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [paidBy, setPaidBy] = useState(editing?.paidBy ?? people[0]);
  const [split, setSplit] = useState<string[]>(editing?.splitAmong ?? people);
  const [date, setDate] = useState(editing?.date ?? "");
  const cur = trip.currency ?? "₹";
  return (
    <Modal title={editing ? "Edit shared cost" : "Add a shared cost"} onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <div><label style={labelStyle} htmlFor="sc-title">What</label><input id="sc-title" autoFocus style={inputStyle} placeholder="e.g. Villa for 3 nights" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex" style={{ gap: 10 }}>
          <div className="flex-1"><label style={labelStyle} htmlFor="sc-amt">Amount ({cur})</label><input id="sc-amt" inputMode="decimal" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
          <div className="flex-1"><label style={labelStyle} htmlFor="sc-date">Date (optional)</label><input id="sc-date" type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div><span style={labelStyle}>Paid by</span><div className="flex flex-wrap" style={{ gap: 6 }}>{people.map((p) => <Chip key={p} on={paidBy === p} onClick={() => setPaidBy(p)}>{p}</Chip>)}</div></div>
        <div><span style={labelStyle}>Split equally between</span><div className="flex flex-wrap" style={{ gap: 6 }}>{people.map((p) => <Chip key={p} on={split.includes(p)} onClick={() => setSplit(split.includes(p) ? split.filter((x) => x !== p) : [...split, p])}>{p}</Chip>)}</div></div>
        {people.length < 2 && <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Add friends as travellers (Edit trip) to split costs with them.</p>}
        <div className="flex" style={{ gap: 8 }}>
          {onDelete && <button className="btn btn-plain" style={{ color: "var(--red)" }} onClick={() => { onDelete(); onClose(); }}>Delete</button>}
          <button className="btn btn-dark flex-1" disabled={!title.trim() || !(Number(amount) > 0) || !split.length} onClick={() => { onSave({ id: editing?.id ?? uid(), title: title.trim(), amount: Number(amount), paidBy, splitAmong: split, ...(date ? { date } : {}) }); onClose(); }}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

/** Everything spent on the trip, whichever month it happened in. */
export function ExpensesTab({ trip, saveTrip }: { trip: Trip; saveTrip: (patch: Partial<Trip>) => Promise<void> }) {
  const { data, mutate } = useSWR<TripExpensesResponse>(`/api/trips/${trip.id}/expenses`, fetcher);
  const { data: cats } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const [shared, setShared] = useState<{ id?: string } | null>(null);
  const items = useMemo(() => data?.items ?? [], [data]);
  const total = items.reduce((s, e) => s + e.amountPaise, 0) / 100;
  const budget = trip.budgetRupees ?? BUDGET_KEYS.reduce((s, k) => s + (trip.budgetPlan[k] ?? 0), 0);
  const today = todayIST();

  const phases = useMemo(() => {
    const out: Record<Phase, TripExpense[]> = { before: [], during: [], after: [] };
    for (const e of items) out[trip.startDate && trip.endDate ? phaseOf(e.date, trip.startDate, trip.endDate) : "before"].push(e);
    return out;
  }, [items, trip.startDate, trip.endDate]);
  const duringTotal = phases.during.reduce((s, e) => s + e.amountPaise, 0) / 100;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) m.set(e.categoryName, (m.get(e.categoryName) ?? 0) + e.amountPaise);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const actualByBucket = useMemo(() => {
    const m: Partial<Record<BudgetKey, number>> = {};
    for (const e of items) { const k = bucketOf(e); m[k] = (m[k] ?? 0) + e.amountPaise / 100; }
    return m;
  }, [items]);
  const hasPlan = BUDGET_KEYS.some((k) => trip.budgetPlan[k]);

  const unlink = async (id: string) => {
    await mutate({ items: items.filter((e) => e.id !== id) }, false);
    await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: [id], link: false });
    mutate();
  };

  const rate = trip.currency && trip.rate ? trip.rate : 1;
  const settle = settleUp(trip.shared, rate);
  const sharedTotal = trip.shared.reduce((s, c) => s + c.amount, 0);
  const fmtShared = (n: number) => (trip.currency ? `${trip.currency} ${Math.round(n).toLocaleString("en-IN")}` : rupees(n));
  const editingShared = shared?.id ? trip.shared.find((c) => c.id === shared.id) : undefined;

  const Row = ({ e }: { e: TripExpense }) => (
    <div className="flex items-center gap-3 py-2 group" style={{ borderTop: "1px solid var(--line2)" }}>
      <span style={{ width: 84, fontSize: 12.5, color: "var(--faint)", flexShrink: 0 }}>{dayLabel(e.date)}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 14 }}>{[e.categoryName, e.subcategory].filter(Boolean).join(" · ")}</span>
        {e.note && <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>{e.note}</span>}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(e.amountPaise)}</span>
      <button onClick={() => unlink(e.id)} className="opacity-0 group-hover:opacity-100" title="Unlink from this trip (stays in Money)" aria-label="Unlink from trip"><X size={14} color="var(--faint)" /></button>
    </div>
  );

  return (
    <div>
      <div className="mb-5" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Spent (from Money)</p>
          <p className="display" style={{ fontSize: 24, marginTop: 4 }}>{rupees(total)}</p>
          <p style={{ fontSize: 12, color: "var(--faint)" }}>{items.length} expense{items.length === 1 ? "" : "s"}</p>
        </div>
        {budget > 0 && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Budget</p>
            <p className="display" style={{ fontSize: 24, marginTop: 4, color: total > budget ? "var(--red)" : undefined }}>{total > budget ? `${rupees(total - budget)} over` : `${rupees(budget - total)} left`}</p>
            <div style={{ height: 6, borderRadius: 6, background: "var(--line2)", marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: 6, width: `${Math.min(100, (total / budget) * 100)}%`, background: total > budget ? "var(--red)" : "#2f6e6b" }} />
            </div>
          </div>
        )}
        {duringTotal > 0 && trip.startDate && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Per day on the trip</p>
            <p className="display" style={{ fontSize: 24, marginTop: 4 }}>{rupees(duringTotal / Math.max(1, Math.min(trip.days, daysBetween(trip.startDate, today) + 1)))}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap mb-5" style={{ gap: 8 }}>
        <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setAdding(true)} disabled={!cats}><Plus size={15} /> Add expense</button>
        <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setLinking(true)} disabled={!trip.startDate}><Link2 size={15} /> Link existing from Money</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
        <div>
          {!data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}
          {data && items.length === 0 && (
            <p className="card" style={{ padding: 16, fontSize: 13.5, color: "var(--dim)" }}>
              No expenses yet. Add them here, pick this trip when adding an expense in Money, or link ones you&apos;ve already logged — tickets and shopping from weeks before count too.
            </p>
          )}
          {(["before", "during", "after"] as Phase[]).map((ph) => {
            const list = phases[ph];
            if (!list.length) return null;
            const sum = list.reduce((s, e) => s + e.amountPaise, 0);
            if (ph === "during" && trip.startDate) {
              const byDay = new Map<number, TripExpense[]>();
              for (const e of list) { const d = daysBetween(trip.startDate, e.date) + 1; byDay.set(d, [...(byDay.get(d) ?? []), e]); }
              return (
                <Section key={ph} title={`${PHASE_LABEL[ph]} · ${paiseToRupees(sum)}`}>
                  {[...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, es]) => (
                    <div key={d} className="mb-2">
                      <p className="flex justify-between" style={{ fontSize: 13, fontWeight: 700 }}>
                        <span>Day {d} <span style={{ color: "var(--faint)", fontWeight: 500 }}>· {dayLabel(dateOfDay(trip.startDate!, d))}</span></span>
                        <span>{paiseToRupees(es.reduce((s, e) => s + e.amountPaise, 0))}</span>
                      </p>
                      {es.map((e) => <Row key={e.id} e={e} />)}
                    </div>
                  ))}
                </Section>
              );
            }
            return (
              <Section key={ph} title={`${PHASE_LABEL[ph]} · ${paiseToRupees(sum)}`}>
                {list.map((e) => <Row key={e.id} e={e} />)}
              </Section>
            );
          })}
        </div>

        <div>
          {byCategory.length > 0 && (
            <Section title="By category">
              {byCategory.map(([name, paise]) => (
                <div key={name} className="mb-2.5">
                  <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 3 }}><span>{name}</span><span style={{ color: "var(--faint)" }}>{paiseToRupees(paise)}</span></div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--line2)" }}><div style={{ height: 6, borderRadius: 6, width: `${(paise / byCategory[0][1]) * 100}%`, background: "#2f6e6b" }} /></div>
                </div>
              ))}
            </Section>
          )}

          {hasPlan && (
            <Section title="Plan vs actual">
              {BUDGET_KEYS.filter((k) => trip.budgetPlan[k] || actualByBucket[k]).map((k) => {
                const plan = trip.budgetPlan[k] ?? 0;
                const actual = actualByBucket[k] ?? 0;
                return (
                  <div key={k} className="flex justify-between py-1.5" style={{ fontSize: 13.5, borderTop: "1px solid var(--line2)" }}>
                    <span>{BUDGET_LABEL[k]}</span>
                    <span><span style={{ color: plan && actual > plan ? "var(--red)" : undefined, fontWeight: 600 }}>{rupees(actual)}</span> <span style={{ color: "var(--faint)" }}>/ {plan ? rupees(plan) : "—"}</span></span>
                  </div>
                );
              })}
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>Money categories are matched to plan buckets by name (Transport → Travel, Stays → Stay, …).</p>
            </Section>
          )}

          <Section
            title="Shared with friends"
            action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setShared({})}><Plus size={13} /> Add</button>}
          >
            {!trip.shared.length ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Travelling with friends? Log who paid for what and see who owes whom. These stay on the trip, not in Money.</p>
            ) : (
              <>
                {trip.shared.map((c) => (
                  <button key={c.id} onClick={() => setShared({ id: c.id })} className="flex items-center gap-2 w-full text-left py-2" style={{ borderTop: "1px solid var(--line2)", fontSize: 14 }}>
                    <span className="flex-1 min-w-0 truncate">{c.title}<span style={{ color: "var(--faint)", fontSize: 12 }}> · {c.paidBy} paid · split {c.splitAmong.length} ways</span></span>
                    <span style={{ fontWeight: 600 }}>{fmtShared(c.amount)}</span>
                  </button>
                ))}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
                  <p style={{ fontSize: 12.5, color: "var(--faint)", marginBottom: 6 }}>Total {fmtShared(sharedTotal)}{trip.currency && trip.rate ? ` ≈ ${rupees(sharedTotal * trip.rate)}` : ""} · settle up{trip.currency && trip.rate ? " (in ₹)" : ""}:</p>
                  {settle.transfers.length === 0 && <p style={{ fontSize: 13.5 }}>All square.</p>}
                  {settle.transfers.map((t, i) => (
                    <p key={i} className="flex items-center gap-2" style={{ fontSize: 14, padding: "3px 0" }}>
                      <strong>{t.from}</strong> <ArrowRight size={13} color="var(--faint)" /> <strong>{t.to}</strong>
                      <span style={{ marginLeft: "auto", fontWeight: 700 }}>{rupees(t.amount)}</span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </Section>
        </div>
      </div>

      {adding && cats && (
        <MoneyQuickAdd
          categories={cats.items}
          initialTripId={trip.id}
          initialDate={trip.startDate && trip.endDate && today >= trip.startDate && today <= trip.endDate ? today : undefined}
          onClose={() => setAdding(false)}
          onSaved={() => mutate()}
        />
      )}
      {linking && <LinkExisting trip={trip} onClose={() => setLinking(false)} onDone={() => mutate()} />}
      {shared && (
        <SharedCostForm
          trip={trip}
          editing={editingShared}
          onClose={() => setShared(null)}
          onSave={(c) => saveTrip({ shared: editingShared ? trip.shared.map((x) => (x.id === c.id ? c : x)) : [...trip.shared, c] })}
          onDelete={editingShared ? () => saveTrip({ shared: trip.shared.filter((x) => x.id !== editingShared.id) }) : undefined}
        />
      )}
    </div>
  );
}
