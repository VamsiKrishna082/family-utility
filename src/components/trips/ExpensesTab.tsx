"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Check, FileText, Link2, MessageCircle, Paperclip, Plus, Search, Sparkles, Trash2, Undo2, Unlink, X } from "lucide-react";
import { budgetBucket, dateOfDay, dayLabel, daysBetween, headCount, phaseOf, settleUp, todayIST, upiLink, type Phase } from "@/lib/trips/logic";
import {
  BUDGET_KEYS, BUDGET_LABEL,
  type BudgetKey, type CashEntry, type SharedCost, type Trip, type TripCandidateMonthsResponse, type TripCandidatesResponse, type TripExpense, type TripExpensesResponse, type TripReceipt, type TripsResponse,
} from "@/lib/trips/types";
import type { MoneyCategoriesResponse, MoneyCategory } from "@/lib/types";
import { MoneyQuickAdd } from "@/components/MoneyQuickAdd";
import { DailySpendChart } from "@/components/trips/DailySpendChart";
import { FieldForm, num, str } from "@/components/trips/FieldForm";
import { Chip, fetcher, inputStyle, labelStyle, Modal, paiseToRupees, rupees, Section, send, smallBtn, uid } from "@/components/trips/shared";

const PHASE_LABEL: Record<Phase, string> = { before: "Before the trip — bookings & shopping", during: "During the trip", after: "After" };
const BAR = "#1b8a6b";

/* ------------------------------ Link existing ------------------------------ */

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** Calendar months the trip's dates fall in — always offered, even when Money has nothing for them yet. */
function tripMonths(trip: Trip): string[] {
  if (!trip.startDate) return [];
  const out: string[] = [];
  const end = (trip.endDate ?? trip.startDate).slice(0, 7);
  for (let m = trip.startDate.slice(0, 7); m <= end && out.length < 24; ) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

const rowStyle = { borderTop: "1px solid var(--line2)", padding: "11px 4px", width: "100%", textAlign: "left" as const, cursor: "pointer" };

/**
 * Link Money expenses in three steps, the way Money itself is organised:
 * pick one of Money's months → pick a category in it → tick expenses.
 * Ticks are kept while you go back and pick another month or category.
 */
function LinkExisting({ trip, onClose, onDone }: { trip: Trip; onClose: () => void; onDone: (linkedIds: string[], totalPaise: number) => void }) {
  const [month, setMonth] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const { data: monthsData } = useSWR<TripCandidateMonthsResponse>(`/api/trips/${trip.id}/candidates`, fetcher);
  const { data, isLoading } = useSWR<TripCandidatesResponse>(month ? `/api/trips/${trip.id}/candidates?month=${month}` : null, fetcher);
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const onTrip = new Set(tripMonths(trip));
  const months = useMemo(() => {
    const have = new Map((monthsData?.months ?? []).map((m) => [m.monthKey, m]));
    for (const m of onTrip) if (!have.has(m)) have.set(m, { monthKey: m, count: 0, totalPaise: 0 });
    return [...have.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsData, trip.startDate, trip.endDate]);

  const monthItems = data?.items ?? [];
  const cats = useMemo(() => {
    const by = new Map<string, { id: string; name: string; group: string; count: number; totalPaise: number; picked: number }>();
    for (const e of monthItems) {
      const c = by.get(e.categoryId) ?? { id: e.categoryId, name: e.categoryName, group: e.categoryGroup, count: 0, totalPaise: 0, picked: 0 };
      c.count += 1;
      c.totalPaise += e.amountPaise;
      if (picked.has(e.id)) c.picked += 1;
      by.set(e.categoryId, c);
    }
    return [...by.values()].sort((a, b) => b.totalPaise - a.totalPaise);
  }, [monthItems, picked]);
  const items = category ? monthItems.filter((e) => e.categoryId === category) : [];
  const catName = cats.find((c) => c.id === category)?.name ?? "";

  const total = [...picked.values()].reduce((s, v) => s + v, 0);
  const allShownPicked = items.length > 0 && items.every((e) => picked.has(e.id));
  const toggle = (e: TripExpense) => setPicked((s) => { const n = new Map(s); if (n.has(e.id)) n.delete(e.id); else n.set(e.id, e.amountPaise); return n; });
  const toggleAll = () => setPicked((s) => { const n = new Map(s); if (allShownPicked) items.forEach((e) => n.delete(e.id)); else items.forEach((e) => n.set(e.id, e.amountPaise)); return n; });
  const link = async () => {
    setBusy(true);
    try {
      await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: [...picked.keys()], link: true });
      onDone([...picked.keys()], total);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const crumb = (label: string, onClick?: () => void) => onClick
    ? <button onClick={onClick} style={{ fontSize: 13, fontWeight: 600, color: "var(--indigo)" }}>{label}</button>
    : <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>;

  return (
    <Modal title="Link expenses from Money" onClose={onClose} wide>
      <div className="flex items-center flex-wrap mb-2" style={{ gap: 6 }}>
        {crumb("Months", month ? () => { setMonth(null); setCategory(null); } : undefined)}
        {month && <><ArrowRight size={12} color="var(--faint)" />{crumb(monthLabel(month), category ? () => setCategory(null) : undefined)}</>}
        {category && <><ArrowRight size={12} color="var(--faint)" />{crumb(catName)}</>}
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {!month && (
          <>
            <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 6 }}>Which month in Money? Tickets and shopping are often months before the trip. Linking doesn&apos;t change anything in Money.</p>
            {!monthsData && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>Loading…</p>}
            {months.map((m) => (
              <button key={m.monthKey} onClick={() => setMonth(m.monthKey)} disabled={!m.count} className="flex items-center gap-3" style={{ ...rowStyle, opacity: m.count ? 1 : 0.55, cursor: m.count ? "pointer" : "default" }}>
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ fontSize: 14.5, fontWeight: 600 }}>{monthLabel(m.monthKey)}{onTrip.has(m.monthKey) ? <span style={{ fontSize: 11.5, fontWeight: 700, color: BAR, marginLeft: 8 }}>TRIP</span> : null}</span>
                  <span className="block" style={{ fontSize: 12, color: "var(--faint)" }}>{m.count ? `${m.count} expense${m.count === 1 ? "" : "s"}` : "Nothing in Money for this month yet"}</span>
                </span>
                {m.count > 0 && <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(m.totalPaise)}</span>}
              </button>
            ))}
            {monthsData && months.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>No expenses in Money yet.</p>}
          </>
        )}

        {month && !category && (
          <>
            <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 6 }}>Which category?</p>
            {isLoading && !data && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>Loading…</p>}
            {data && cats.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)", padding: 10 }}>No expenses left to link in this month.</p>}
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className="flex items-center gap-3" style={rowStyle}>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>{c.name}</span>
                  <span className="block" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {c.group ? `${c.group} · ` : ""}{c.count} expense{c.count === 1 ? "" : "s"}{c.picked ? ` · ${c.picked} ticked` : ""}
                  </span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(c.totalPaise)}</span>
              </button>
            ))}
          </>
        )}

        {month && category && (
          <>
            {items.length > 0 && (
              <label className="flex items-center gap-2 py-1.5" style={{ fontSize: 13, color: "var(--dim)", cursor: "pointer" }}>
                <input type="checkbox" checked={allShownPicked} onChange={toggleAll} style={{ width: 16, height: 16 }} /> Select all {items.length}
              </label>
            )}
            {items.map((e) => (
              <label key={e.id} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--line2)", cursor: "pointer" }}>
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e)} style={{ width: 17, height: 17 }} />
                <span style={{ width: 92, fontSize: 12.5, color: "var(--faint)", flexShrink: 0 }}>{dayLabel(e.date)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ fontSize: 14 }}>{e.note || e.subcategory || e.categoryName}</span>
                  <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {[e.note && e.subcategory, e.mode?.replace(/_/g, " ")].filter(Boolean).join(" · ")}{e.otherTripId ? " · on another trip (will move here)" : ""}
                  </span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(e.amountPaise)}</span>
              </label>
            ))}
          </>
        )}
      </div>

      <button className="btn btn-dark w-full mt-3" disabled={!picked.size || busy} onClick={link}>
        {busy ? "Linking…" : picked.size ? `Link ${picked.size} expense${picked.size === 1 ? "" : "s"} · ${paiseToRupees(total)}` : "Pick expenses to link"}
      </button>
    </Modal>
  );
}

/* ------------------------------ Shared costs ------------------------------ */

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

function UpiForm({ trip, onClose, onSave }: { trip: Trip; onClose: () => void; onSave: (upi: Record<string, string>) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(trip.upi);
  const bad = Object.values(vals).some((v) => v.trim() && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(v.trim()));
  return (
    <Modal title="UPI ids" onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 12 }}>Used to add a “pay here” link to settle-up messages.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {trip.travellers.map((t) => (
          <label key={t} className="flex items-center" style={{ gap: 10, fontSize: 14 }}>
            <span style={{ width: 90 }}>{t}</span>
            <input style={inputStyle} placeholder="name@okhdfcbank" value={vals[t] ?? ""} onChange={(e) => setVals({ ...vals, [t]: e.target.value })} aria-label={`${t} UPI id`} />
          </label>
        ))}
      </div>
      {bad && <p style={{ fontSize: 12.5, color: "var(--red)", marginTop: 8 }}>A UPI id looks like name@bank.</p>}
      <button className="btn btn-dark w-full mt-4" disabled={bad} onClick={() => { onSave(Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))); onClose(); }}>Save</button>
    </Modal>
  );
}

/* --------------------------------- Compare --------------------------------- */

type CompareSide = { name: string; days: number; heads: number; total: number; perPerson: number; perPersonPerDay: number; byBucket: Partial<Record<BudgetKey, number>> };

function Compare({ trip }: { trip: Trip }) {
  const { data: trips } = useSWR<TripsResponse>("/api/trips", fetcher);
  const others = (trips?.items ?? []).filter((t) => t.id !== trip.id && t.expenseCount > 0);
  const [other, setOther] = useState("");
  const { data } = useSWR<{ a: CompareSide; b: CompareSide }>(other ? `/api/trips/${trip.id}/compare?with=${other}` : null, fetcher);
  if (!others.length) return <p style={{ fontSize: 13, color: "var(--faint)" }}>Once another trip has expenses linked, compare them here.</p>;
  const row = (label: string, a: number, b: number) => (
    <tr key={label} style={{ borderTop: "1px solid var(--line2)" }}>
      <td style={{ padding: "5px 0" }}>{label}</td>
      <td style={{ textAlign: "right", fontWeight: 600 }}>{rupees(a)}</td>
      <td style={{ textAlign: "right", color: "var(--dim)" }}>{rupees(b)}</td>
    </tr>
  );
  return (
    <div>
      <select aria-label="Trip to compare with" value={other} onChange={(e) => setOther(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
        <option value="">Compare with…</option>
        {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {data && (
        <table style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
          <thead><tr style={{ color: "var(--faint)" }}><th style={{ textAlign: "left", fontWeight: 600 }} /><th style={{ textAlign: "right", fontWeight: 600 }}>This trip</th><th style={{ textAlign: "right", fontWeight: 600 }} className="truncate">{data.b.name}</th></tr></thead>
          <tbody>
            {row("Net total", data.a.total, data.b.total)}
            {row("Per person", data.a.perPerson, data.b.perPerson)}
            {row("Per person per day", data.a.perPersonPerDay, data.b.perPersonPerDay)}
            {BUDGET_KEYS.filter((k) => data.a.byBucket[k] || data.b.byBucket[k]).map((k) => row(BUDGET_LABEL[k], data.a.byBucket[k] ?? 0, data.b.byBucket[k] ?? 0))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------- Expenses tab ------------------------------ */

/** Everything spent on the trip, whichever month it happened in — plus refunds, receipts, friends and cash. */
export function ExpensesTab({ trip, saveTrip, onTripChanged }: { trip: Trip; saveTrip: (patch: Partial<Trip>) => Promise<void>; onTripChanged: () => void }) {
  const { data, mutate } = useSWR<TripExpensesResponse>(`/api/trips/${trip.id}/expenses`, fetcher);
  const { data: cats } = useSWR<MoneyCategoriesResponse>("/api/money/categories", fetcher);
  const { data: sugg, mutate: mutateSugg } = useSWR<{ items: (TripExpense & { reason: string })[] }>(trip.startDate ? `/api/trips/${trip.id}/suggestions` : null, fetcher);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [shared, setShared] = useState<{ id?: string } | null>(null);
  const [upiOpen, setUpiOpen] = useState(false);
  const [cashForm, setCashForm] = useState<{ id?: string } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<{ txId?: string; sharedId?: string }>({});
  const items = useMemo(() => data?.items ?? [], [data]);
  const refunds = useMemo(() => data?.refunds ?? [], [data]);
  const spent = items.reduce((s, e) => s + e.amountPaise, 0) / 100;
  const refunded = refunds.reduce((s, e) => s + e.amountPaise, 0) / 100;
  const net = spent - refunded;
  const budget = trip.budgetRupees ?? BUDGET_KEYS.reduce((s, k) => s + (trip.budgetPlan[k] ?? 0), 0);
  const heads = headCount(trip.travellers);
  const today = todayIST();
  const refetchAll = () => { mutate(); mutateSugg(); };

  const phases = useMemo(() => {
    const out: Record<Phase, TripExpense[]> = { before: [], during: [], after: [] };
    for (const e of items) out[trip.startDate && trip.endDate ? phaseOf(e.date, trip.startDate, trip.endDate) : "before"].push(e);
    return out;
  }, [items, trip.startDate, trip.endDate]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) m.set(e.categoryName, (m.get(e.categoryName) ?? 0) + e.amountPaise);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const actualByBucket = useMemo(() => {
    const m: Partial<Record<BudgetKey, number>> = {};
    for (const e of items) { const k = budgetBucket(e.categoryGroup, e.categoryName); m[k] = (m[k] ?? 0) + e.amountPaise / 100; }
    return m;
  }, [items]);
  const perDay = useMemo(() => {
    if (!trip.startDate) return [];
    return Array.from({ length: trip.days }, (_, i) => {
      const date = dateOfDay(trip.startDate!, i + 1);
      return { label: `Day ${i + 1}`, sub: dayLabel(date), value: phases.during.filter((e) => e.date === date).reduce((s, e) => s + e.amountPaise, 0) / 100 };
    });
  }, [phases.during, trip.startDate, trip.days]);
  const tripDaysSoFar = trip.startDate ? Math.max(1, Math.min(trip.days, daysBetween(trip.startDate, today) + 1)) : trip.days;
  const hasPlan = BUDGET_KEYS.some((k) => trip.budgetPlan[k]);
  const receiptsFor = (txId?: string, sharedId?: string) => trip.receipts.filter((r) => (txId && r.txId === txId) || (sharedId && r.sharedId === sharedId));

  // Linking and unlinking only set/clear the trip tag on Money entries, so
  // every change can be undone from the bar that appears after it.
  const [undo, setUndo] = useState<{ ids: string[]; linked: boolean; text: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerUndo = (u: { ids: string[]; linked: boolean; text: string }) => {
    setUndo(u);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 15000);
  };
  const countText = (ids: string[], paise: number) => `${ids.length} expense${ids.length === 1 ? "" : "s"} · ${paiseToRupees(paise)}`;

  const unlinkMany = async (ids: string[]) => {
    if (!ids.length) return;
    const gone = new Set(ids);
    const paise = items.filter((e) => gone.has(e.id)).reduce((s, e) => s + e.amountPaise, 0);
    await mutate({ items: items.filter((e) => !gone.has(e.id)), refunds }, false);
    await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: ids, link: false });
    refetchAll();
    offerUndo({ ids, linked: false, text: `Unlinked ${countText(ids, paise)} — still in Money` });
  };
  const unlink = (id: string) => unlinkMany([id]);
  const linkSuggested = async (ids: string[]) => {
    const paise = (sugg?.items ?? []).filter((s) => ids.includes(s.id)).reduce((s, e) => s + e.amountPaise, 0);
    await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: ids, link: true });
    refetchAll();
    offerUndo({ ids, linked: true, text: `Linked ${countText(ids, paise)}` });
  };
  const undoLast = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    await send(`/api/trips/${trip.id}/expenses`, "POST", { txIds: u.ids, link: !u.linked });
    refetchAll();
  };

  // select several to unlink at once
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selPaise = items.filter((e) => sel.has(e.id)).reduce((s, e) => s + e.amountPaise, 0);
  const stopSelecting = () => { setSelecting(false); setSel(new Set()); };

  const pickReceipt = (target: { txId?: string; sharedId?: string }) => { uploadFor.current = target; fileRef.current?.click(); };
  const onReceipt = async (file: File | undefined) => {
    if (!file) return;
    const t = uploadFor.current;
    setUploading(t.txId ?? t.sharedId ?? "general");
    try {
      const qs = new URLSearchParams({ name: file.name, ...(t.txId ? { txId: t.txId } : {}), ...(t.sharedId ? { sharedId: t.sharedId } : {}) });
      const res = await fetch(`/api/trips/${trip.id}/receipts?${qs}`, { method: "POST", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
      if (!res.ok) alertInline((await res.json().catch(() => ({}))).error ?? "Could not upload");
      onTripChanged(); // receipts live on the trip record
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const [notice, setNotice] = useState("");
  const alertInline = (m: string) => { setNotice(m); setTimeout(() => setNotice(""), 4000); };
  const deleteReceipt = async (r: TripReceipt) => { await send(`/api/trips/${trip.id}/receipts?r=${r.id}`, "DELETE"); onTripChanged(); };

  const ReceiptChips = ({ list }: { list: TripReceipt[] }) => (
    <>{list.map((r) => (
      <a key={r.id} href={`/api/trips/${trip.id}/receipts?r=${r.id}`} target="_blank" rel="noreferrer" title={r.name} className="flex items-center" style={{ gap: 3, fontSize: 11.5, color: "var(--indigo)" }}>
        <FileText size={12} />
      </a>
    ))}</>
  );

  const Row = ({ e }: { e: TripExpense }) => (
    <div className="flex items-center gap-3 py-2 group" style={{ borderTop: "1px solid var(--line2)", cursor: selecting ? "pointer" : undefined }} onClick={selecting ? () => toggleSel(e.id) : undefined}>
      {selecting && <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggleSel(e.id)} onClick={(ev) => ev.stopPropagation()} style={{ width: 17, height: 17, flexShrink: 0 }} aria-label={`Select ${e.note || e.categoryName}`} />}
      <span style={{ width: 84, fontSize: 12.5, color: "var(--faint)", flexShrink: 0 }}>{dayLabel(e.date)}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 14 }}>{[e.categoryName, e.subcategory].filter(Boolean).join(" · ")}</span>
        {e.note && <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>{e.note}</span>}
      </span>
      <ReceiptChips list={receiptsFor(e.id)} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{paiseToRupees(e.amountPaise)}</span>
      {!selecting && (
        <>
          <button onClick={() => pickReceipt({ txId: e.id })} className={receiptsFor(e.id).length ? "" : "opacity-0 group-hover:opacity-100"} title="Attach a receipt" aria-label="Attach a receipt">
            {uploading === e.id ? <span style={{ fontSize: 11 }}>…</span> : <Paperclip size={14} color="var(--faint)" />}
          </button>
          <button onClick={() => unlink(e.id)} title="Unlink from this trip (stays in Money)" aria-label="Unlink from trip" style={{ padding: 4 }}><Unlink size={14} color="var(--faint)" /></button>
        </>
      )}
    </div>
  );

  // settle up
  const rate = trip.currency && trip.rate ? trip.rate : 1;
  const settle = settleUp(trip.shared, rate, trip.settlements);
  const sharedTotal = trip.shared.reduce((s, c) => s + c.amount, 0);
  const fmtShared = (n: number) => (trip.currency ? `${trip.currency} ${Math.round(n).toLocaleString("en-IN")}` : rupees(n));
  const editingShared = shared?.id ? trip.shared.find((c) => c.id === shared.id) : undefined;
  const whatsapp = (t: { from: string; to: string; amount: number }) => {
    const upi = trip.upi[t.to];
    const text = `Hi ${t.from}, for our ${trip.name} trip your share comes to ${rupees(t.amount)} (to ${t.to}).${upi ? `\nPay by UPI: ${upiLink(upi, t.to, t.amount, trip.name)}\nUPI id: ${upi}` : ""}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // cash & forex
  const cashByCurrency = useMemo(() => {
    const m = new Map<string, { in: number; out: number; inr: number }>();
    for (const c of trip.cash) {
      const cur = m.get(c.currency) ?? { in: 0, out: 0, inr: 0 };
      if (c.kind === "in") { cur.in += c.amount; cur.inr += c.inrCost ?? (c.currency === "INR" ? c.amount : 0); } else cur.out += c.amount;
      m.set(c.currency, cur);
    }
    return [...m.entries()];
  }, [trip.cash]);
  const editingCash = cashForm?.id ? trip.cash.find((c) => c.id === cashForm.id) : undefined;
  const refundCategory = cats?.items.find((c) => c.type === "income" && /refund/i.test(c.name)) ?? cats?.items.find((c) => c.type === "income");

  const card = (label: string, value: string, note?: string, tone?: string) => (
    <div className="card" style={{ padding: 16 }}>
      <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{label}</p>
      <p className="display" style={{ fontSize: 22, marginTop: 4, color: tone }}>{value}</p>
      {note && <p style={{ fontSize: 12, color: "var(--faint)" }}>{note}</p>}
    </div>
  );

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onReceipt(e.target.files?.[0])} />

      <div className="mb-5" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {card(refunded ? "Net cost" : "Spent (from Money)", rupees(net), refunded ? `${rupees(spent)} spent − ${rupees(refunded)} refunded` : `${items.length} expense${items.length === 1 ? "" : "s"}`)}
        {budget > 0 && card("Budget", net > budget ? `${rupees(net - budget)} over` : `${rupees(budget - net)} left`, `of ${rupees(budget)}`, net > budget ? "var(--red)" : undefined)}
        {net > 0 && card("Per person", rupees(net / heads), `${heads} people${trip.travellers.some((t) => t.toLowerCase() === "us") ? " (“Us” = 2)" : ""}`)}
        {net > 0 && card("Per person per day", rupees(net / heads / tripDaysSoFar), `over ${tripDaysSoFar} day${tripDaysSoFar === 1 ? "" : "s"}`)}
      </div>

      <div className="flex flex-wrap mb-5" style={{ gap: 8 }}>
        <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setAdding(true)} disabled={!cats}><Plus size={15} /> Add expense</button>
        <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setLinking(true)} disabled={!cats}><Link2 size={15} /> Link existing from Money</button>
        <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setRefunding(true)} disabled={!refundCategory}><Undo2 size={15} /> Add a refund</button>
        <button className="btn btn-plain flex items-center gap-1.5" onClick={() => pickReceipt({})}><Paperclip size={15} /> {uploading === "general" ? "Uploading…" : "Upload a receipt"}</button>
      </div>
      {notice && <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{notice}</p>}
      {undo && (
        <div role="status" className="flex items-center gap-3" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 60, background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "10px 12px 10px 16px", fontSize: 13.5, boxShadow: "0 8px 24px rgba(0,0,0,.18)", maxWidth: "calc(100vw - 32px)" }}>
          <span className="min-w-0">{undo.text}</span>
          <button onClick={undoLast} style={{ fontWeight: 700, color: "#fff", textDecoration: "underline", flexShrink: 0 }}>Undo</button>
          <button onClick={() => setUndo(null)} aria-label="Dismiss" style={{ flexShrink: 0 }}><X size={14} color="#fff" /></button>
        </div>
      )}

      {sugg && sugg.items.length > 0 && (
        <div className="card mb-5" style={{ padding: 14, borderColor: BAR }}>
          <div className="flex items-center justify-between mb-2" style={{ gap: 8 }}>
            <p className="flex items-center" style={{ gap: 6, fontSize: 14, fontWeight: 700 }}><Sparkles size={15} color={BAR} /> {sugg.items.length} expense{sugg.items.length === 1 ? " looks" : "s look"} like this trip</p>
            <button className="btn btn-plain" style={smallBtn} onClick={() => linkSuggested(sugg.items.map((s) => s.id))}>Link all</button>
          </div>
          {sugg.items.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-1.5" style={{ borderTop: "1px solid var(--line2)", fontSize: 13.5 }}>
              <span style={{ width: 84, color: "var(--faint)", fontSize: 12.5 }}>{dayLabel(s.date)}</span>
              <span className="flex-1 min-w-0 truncate">{[s.categoryName, s.subcategory].filter(Boolean).join(" · ")} <span style={{ color: "var(--faint)", fontSize: 12 }}>· {s.reason}</span></span>
              <span style={{ fontWeight: 600 }}>{paiseToRupees(s.amountPaise)}</span>
              <button className="btn btn-plain" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => linkSuggested([s.id])}>Link</button>
            </div>
          ))}
          {sugg.items.length > 8 && <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>+{sugg.items.length - 8} more — “Link all” includes them.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
        <div>
          {!data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}
          {data && items.length === 0 && (
            <p className="card" style={{ padding: 16, fontSize: 13.5, color: "var(--dim)" }}>No expenses yet. Add them here, pick this trip when adding an expense in Money, or link ones you&apos;ve already logged — from any month.</p>
          )}

          {items.length > 0 && (
            <div className="flex items-center justify-end mb-2" style={{ gap: 8 }}>
              {selecting ? (
                <>
                  <span style={{ fontSize: 13, color: "var(--dim)", marginRight: "auto" }}>{sel.size ? `${sel.size} selected · ${paiseToRupees(selPaise)}` : "Tap expenses to select"}</span>
                  <button className="btn btn-plain" style={smallBtn} onClick={() => setSel(sel.size === items.length ? new Set() : new Set(items.map((e) => e.id)))}>{sel.size === items.length ? "Clear" : "Select all"}</button>
                  <button className="btn btn-plain" style={smallBtn} onClick={stopSelecting}>Cancel</button>
                  <button className="btn btn-dark flex items-center gap-1" style={smallBtn} disabled={!sel.size} onClick={async () => { const ids = [...sel]; stopSelecting(); await unlinkMany(ids); }}>
                    <Unlink size={13} /> Unlink{sel.size ? ` ${sel.size}` : ""}
                  </button>
                </>
              ) : (
                <button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setSelecting(true)}><Unlink size={13} /> Unlink several</button>
              )}
            </div>
          )}

          {perDay.some((d) => d.value > 0) && (
            <Section title="Spend per day on the trip">
              <DailySpendChart days={perDay} />
            </Section>
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
            return <Section key={ph} title={`${PHASE_LABEL[ph]} · ${paiseToRupees(sum)}`}>{list.map((e) => <Row key={e.id} e={e} />)}</Section>;
          })}

          {refunds.length > 0 && (
            <Section title={`Refunds & cancellations · ${rupees(refunded)}`}>
              {refunds.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--line2)" }}>
                  <span style={{ width: 84, fontSize: 12.5, color: "var(--faint)" }}>{dayLabel(e.date)}</span>
                  <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14 }}>{e.note || e.categoryName}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>+{paiseToRupees(e.amountPaise)}</span>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>Recorded in Money as income, so your balance there is right too.</p>
            </Section>
          )}

          {trip.receipts.filter((r) => !r.txId && !r.sharedId).length > 0 && (
            <Section title="Receipts">
              {trip.receipts.filter((r) => !r.txId && !r.sharedId).map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-1.5" style={{ borderTop: "1px solid var(--line2)", fontSize: 13.5 }}>
                  <FileText size={14} color="var(--faint)" />
                  <a href={`/api/trips/${trip.id}/receipts?r=${r.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate" style={{ color: "var(--indigo)" }}>{r.name}</a>
                  <button onClick={() => deleteReceipt(r)} aria-label="Delete receipt"><Trash2 size={13} color="var(--faint)" /></button>
                </div>
              ))}
            </Section>
          )}
        </div>

        <div>
          {byCategory.length > 0 && (
            <Section title="By category">
              {byCategory.map(([name, paise]) => (
                <div key={name} className="mb-2.5" title={`${name}: ${paiseToRupees(paise)} (${Math.round((paise / (spent * 100)) * 100)}%)`}>
                  <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 3 }}><span>{name}</span><span style={{ color: "var(--faint)" }}>{paiseToRupees(paise)} · {Math.round((paise / (spent * 100)) * 100)}%</span></div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--line2)" }}><div style={{ height: 6, borderRadius: 6, width: `${(paise / byCategory[0][1]) * 100}%`, background: BAR }} /></div>
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

          <Section title="Compare with another trip"><Compare trip={trip} /></Section>

          <Section
            title="Shared with friends"
            action={<span className="flex items-center" style={{ gap: 8 }}>
              {trip.travellers.length > 1 && <button style={{ fontSize: 12.5, color: "var(--faint)" }} onClick={() => setUpiOpen(true)}>UPI ids</button>}
              <button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setShared({})}><Plus size={13} /> Add</button>
            </span>}
          >
            {!trip.shared.length ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Travelling with friends? Log who paid for what and see who owes whom. These stay on the trip, not in Money.</p>
            ) : (
              <>
                {trip.shared.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-2 group" style={{ borderTop: "1px solid var(--line2)", fontSize: 14 }}>
                    <button onClick={() => setShared({ id: c.id })} className="flex-1 min-w-0 truncate text-left">{c.title}<span style={{ color: "var(--faint)", fontSize: 12 }}> · {c.paidBy} paid · split {c.splitAmong.length} ways</span></button>
                    <ReceiptChips list={receiptsFor(undefined, c.id)} />
                    <button onClick={() => pickReceipt({ sharedId: c.id })} className="opacity-0 group-hover:opacity-100" aria-label="Attach a receipt"><Paperclip size={13} color="var(--faint)" /></button>
                    <span style={{ fontWeight: 600 }}>{fmtShared(c.amount)}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}>
                  <p style={{ fontSize: 12.5, color: "var(--faint)", marginBottom: 6 }}>Total {fmtShared(sharedTotal)}{trip.currency && trip.rate ? ` ≈ ${rupees(sharedTotal * trip.rate)}` : ""} · still to settle (₹):</p>
                  {settle.transfers.length === 0 && <p style={{ fontSize: 13.5 }}>All square. 🎉</p>}
                  {settle.transfers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ fontSize: 14, padding: "4px 0", flexWrap: "wrap" }}>
                      <strong>{t.from}</strong> <ArrowRight size={13} color="var(--faint)" /> <strong>{t.to}</strong>
                      <span style={{ fontWeight: 700 }}>{rupees(t.amount)}</span>
                      <span className="flex items-center" style={{ gap: 6, marginLeft: "auto" }}>
                        <a href={whatsapp(t)} target="_blank" rel="noreferrer" className="btn btn-plain flex items-center gap-1" style={{ padding: "3px 8px", fontSize: 12 }}><MessageCircle size={12} /> Remind</a>
                        <button className="btn btn-plain flex items-center gap-1" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => saveTrip({ settlements: [...trip.settlements, { id: uid(), from: t.from, to: t.to, amount: t.amount, date: today }] })}>
                          <Check size={12} /> Mark paid
                        </button>
                      </span>
                    </div>
                  ))}
                  {trip.settlements.length > 0 && (
                    <div className="mt-2">
                      <p style={{ fontSize: 12, color: "var(--faint)" }}>Settled</p>
                      {trip.settlements.map((st) => (
                        <p key={st.id} className="flex items-center gap-2" style={{ fontSize: 12.5, color: "var(--dim)", padding: "2px 0" }}>
                          {st.from} paid {st.to} {rupees(st.amount)} · {dayLabel(st.date)}
                          <button onClick={() => saveTrip({ settlements: trip.settlements.filter((x) => x.id !== st.id) })} style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--faint)" }}>Undo</button>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </Section>

          <Section
            title="Cash & forex"
            action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setCashForm({})}><Plus size={13} /> Add</button>}
          >
            {!trip.cash.length ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Track cash taken out or foreign currency bought, and cash spent — see what&apos;s left and your effective rate.</p>
            ) : (
              <>
                {cashByCurrency.map(([cur, v]) => (
                  <div key={cur} className="flex justify-between py-1.5" style={{ fontSize: 14, borderTop: "1px solid var(--line2)" }}>
                    <span><strong>{cur}</strong> <span style={{ color: "var(--faint)", fontSize: 12.5 }}>in {v.in.toLocaleString("en-IN")} · spent {v.out.toLocaleString("en-IN")}{cur !== "INR" && v.inr && v.in ? ` · ₹${(v.inr / v.in).toFixed(2)} each` : ""}</span></span>
                    <span style={{ fontWeight: 700, color: v.in - v.out < 0 ? "var(--red)" : undefined }}>{(v.in - v.out).toLocaleString("en-IN")} left</span>
                  </div>
                ))}
                {[...trip.cash].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((c: CashEntry) => (
                  <button key={c.id} onClick={() => setCashForm({ id: c.id })} className="flex justify-between w-full text-left" style={{ fontSize: 12.5, color: "var(--dim)", padding: "3px 0" }}>
                    <span>{dayLabel(c.date)} · {c.kind === "in" ? "got" : "spent"} {c.note ? `· ${c.note}` : ""}</span>
                    <span>{c.kind === "in" ? "+" : "−"}{c.amount.toLocaleString("en-IN")} {c.currency}</span>
                  </button>
                ))}
              </>
            )}
          </Section>
        </div>
      </div>

      {adding && cats && (
        <MoneyQuickAdd categories={cats.items} initialTripId={trip.id} initialDate={trip.startDate && trip.endDate && today >= trip.startDate && today <= trip.endDate ? today : undefined} onClose={() => setAdding(false)} onSaved={refetchAll} />
      )}
      {linking && cats && <LinkExisting trip={trip} onClose={() => setLinking(false)} onDone={(ids, paise) => { refetchAll(); offerUndo({ ids, linked: true, text: `Linked ${countText(ids, paise)}` }); }} />}
      {refunding && refundCategory && (
        <FieldForm
          title="Add a refund or cancellation"
          fields={[
            { key: "amount", label: "Amount refunded (₹)", type: "number", required: true },
            { key: "date", label: "Date", type: "date", required: true },
            { key: "note", label: "What for", type: "text", required: true, placeholder: "e.g. Cancelled hotel night" },
          ]}
          initial={{ date: today }}
          submitLabel="Add refund"
          onClose={() => setRefunding(false)}
          onSubmit={async (v) => {
            await send("/api/money/tx", "POST", {
              type: "income", amountPaise: Math.round(Number(v.amount) * 100), date: v.date, categoryId: refundCategory.id,
              subcategory: trip.name.slice(0, 60), note: v.note, tripId: trip.id, tags: [],
            });
            refetchAll();
          }}
        />
      )}
      {shared && (
        <SharedCostForm
          trip={trip}
          editing={editingShared}
          onClose={() => setShared(null)}
          onSave={(c) => saveTrip({ shared: editingShared ? trip.shared.map((x) => (x.id === c.id ? c : x)) : [...trip.shared, c] })}
          onDelete={editingShared ? () => saveTrip({ shared: trip.shared.filter((x) => x.id !== editingShared.id) }) : undefined}
        />
      )}
      {upiOpen && <UpiForm trip={trip} onClose={() => setUpiOpen(false)} onSave={(upi) => saveTrip({ upi })} />}
      {cashForm && (
        <FieldForm
          title={editingCash ? "Edit cash entry" : "Cash or forex"}
          fields={[
            { key: "kind", label: "Type", type: "select", required: true, options: [{ value: "in", label: "Got cash / bought currency" }, { value: "out", label: "Spent cash" }] },
            { key: "amount", label: "Amount", type: "number", required: true },
            { key: "currency", label: "Currency", type: "text", required: true, placeholder: "INR, USD, THB…" },
            { key: "inrCost", label: "Cost in ₹ (for currency bought)", type: "number" },
            { key: "date", label: "Date", type: "date", required: true },
            { key: "note", label: "Note", type: "text" },
          ]}
          initial={editingCash
            ? Object.fromEntries(Object.entries(editingCash).filter(([k, v]) => k !== "id" && v !== undefined).map(([k, v]) => [k, String(v)]))
            : { kind: "in", currency: trip.currency ?? "INR", date: today }}
          onClose={() => setCashForm(null)}
          onSubmit={(v) => {
            const entry = JSON.parse(JSON.stringify({ id: editingCash?.id ?? uid(), kind: v.kind as "in" | "out", amount: Number(v.amount), currency: v.currency.toUpperCase(), inrCost: num(v.inrCost), date: v.date, note: str(v.note) })) as CashEntry;
            return saveTrip({ cash: editingCash ? trip.cash.map((c) => (c.id === entry.id ? entry : c)) : [...trip.cash, entry] });
          }}
          onDelete={editingCash ? () => saveTrip({ cash: trip.cash.filter((c) => c.id !== editingCash.id) }) : undefined}
        />
      )}
    </div>
  );
}
