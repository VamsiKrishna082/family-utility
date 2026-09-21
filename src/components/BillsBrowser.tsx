"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Check } from "lucide-react";
import { formatINR } from "@/lib/money";
import { BILL_FREQUENCIES, type Bill } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const todayISO = () => new Date().toISOString().slice(0, 10);

function addInterval(dateISO: string, frequency: Bill["frequency"]): string {
  const d = new Date(dateISO);
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function statusOf(dueDate: string): { label: string; color: string } {
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `${-days}d overdue`, color: "var(--red)" };
  if (days === 0) return { label: "Due today", color: "var(--amber)" };
  if (days <= 7) return { label: `Due in ${days}d`, color: "var(--amber)" };
  return { label: new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), color: "var(--faint)" };
}

export function BillsBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: Bill[] }>("/api/bills", fetcher);
  const bills = useMemo(() => [...(data?.items ?? [])].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)), [data]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Bill["frequency"]>("monthly");
  const [nextDueDate, setNextDueDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const amt = Number(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    setSaving(true);
    await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), amount: amt, frequency, nextDueDate, autopay: false, notes: "" }),
    });
    setName("");
    setAmount("");
    setSaving(false);
    mutate();
  };

  const markPaid = async (bill: Bill) => {
    if (bill.frequency === "once") {
      await mutate({ items: bills.filter((b) => b.id !== bill.id) }, false);
      await fetch(`/api/bills/${bill.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextDueDate: addInterval(bill.nextDueDate, bill.frequency) }),
      });
    }
    mutate();
  };

  const remove = async (id: string) => {
    await mutate({ items: bills.filter((b) => b.id !== id) }, false);
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Bills</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Bills and renewals — mark paid to roll the date forward.</p>

      <div className="card mt-7" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Add a bill</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Name, e.g. Electricity"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
            style={{ minWidth: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="₹ Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 120, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Bill["frequency"])} style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}>
            {BILL_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }}
          />
          <button className="btn btn-dark flex items-center gap-1.5" onClick={add} disabled={saving}><Plus size={15} /> Add</button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : bills.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No bills tracked yet.</p>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {bills.map((b, i) => {
              const status = statusOf(b.nextDueDate);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
                  <span style={{ fontSize: 14.5, flexShrink: 0, width: 150 }} className="truncate">{b.name}</span>
                  <span style={{ fontSize: 12.5, color: "var(--faint)", width: 70, flexShrink: 0 }}>{b.frequency}</span>
                  <span style={{ fontSize: 13, color: status.color, width: 100, flexShrink: 0 }}>{status.label}</span>
                  <span className="flex-1" style={{ fontSize: 14.5, fontWeight: 600, textAlign: "right" }}>{formatINR(b.amount)}</span>
                  <button className="btn btn-plain flex items-center gap-1" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => markPaid(b)}>
                    <Check size={13} /> Paid
                  </button>
                  <button onClick={() => remove(b.id)} style={{ color: "var(--faint)" }} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
