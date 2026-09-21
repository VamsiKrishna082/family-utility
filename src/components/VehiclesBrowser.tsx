"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Fuel, Wrench } from "lucide-react";
import { formatINR } from "@/lib/money";
import type { Vehicle, VehicleLog } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const todayISO = () => new Date().toISOString().slice(0, 10);

function VehicleCard({ vehicle, onChange }: { vehicle: Vehicle; onChange: () => void }) {
  const [kind, setKind] = useState<VehicleLog["kind"]>("fuel");
  const [amount, setAmount] = useState("");
  const [odometer, setOdometer] = useState("");
  const [saving, setSaving] = useState(false);

  const totalSpend = vehicle.logs.reduce((s, l) => s + l.amount, 0);

  const addLog = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const log: VehicleLog = {
      id: crypto.randomUUID(), date: todayISO(), kind,
      odometer: odometer ? Number(odometer) : null, amount: amt, notes: "",
    };
    await fetch(`/api/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: [log, ...vehicle.logs] }),
    });
    setAmount("");
    setOdometer("");
    setSaving(false);
    onChange();
  };

  const removeLog = async (id: string) => {
    await fetch(`/api/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: vehicle.logs.filter((l) => l.id !== id) }),
    });
    onChange();
  };

  const removeVehicle = async () => {
    await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="display" style={{ fontSize: 19 }}>{vehicle.name}</p>
          {vehicle.regNumber && <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 2 }}>{vehicle.regNumber}</p>}
        </div>
        <div className="text-right">
          <p style={{ color: "var(--faint)", fontSize: 12 }}>Total spend</p>
          <p style={{ fontSize: 16, fontWeight: 600 }}>{formatINR(totalSpend)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <div className="flex" style={{ borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden" }}>
          {(["fuel", "service"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="flex items-center gap-1.5"
              style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, background: kind === k ? "var(--ink)" : "var(--card)", color: kind === k ? "#fff" : "var(--dim)" }}>
              {k === "fuel" ? <Fuel size={13} /> : <Wrench size={13} />} {k}
            </button>
          ))}
        </div>
        <input type="number" inputMode="decimal" placeholder="₹ Amount" value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ width: 100, borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 13.5 }} />
        <input type="number" inputMode="numeric" placeholder="Odometer" value={odometer} onChange={(e) => setOdometer(e.target.value)}
          style={{ width: 100, borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 13.5 }} />
        <button className="btn btn-plain flex items-center gap-1" style={{ padding: "7px 12px", fontSize: 13 }} onClick={addLog} disabled={saving}>
          <Plus size={14} /> Log
        </button>
        <button onClick={removeVehicle} style={{ color: "var(--faint)", marginLeft: "auto" }} aria-label="Delete vehicle"><Trash2 size={15} /></button>
      </div>

      {vehicle.logs.length > 0 && (
        <div className="mt-4" style={{ borderTop: "1px solid var(--line2)" }}>
          {vehicle.logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--line2)" }}>
              {l.kind === "fuel" ? <Fuel size={14} color="var(--faint)" /> : <Wrench size={14} color="var(--faint)" />}
              <span style={{ fontSize: 13, color: "var(--faint)", width: 74 }}>
                {new Date(l.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
              {l.odometer != null && <span style={{ fontSize: 13, color: "var(--faint)" }}>{l.odometer.toLocaleString("en-IN")} km</span>}
              <span className="flex-1" style={{ fontSize: 14, fontWeight: 600, textAlign: "right" }}>{formatINR(l.amount)}</span>
              <button onClick={() => removeLog(l.id)} style={{ color: "var(--faint)" }} aria-label="Remove"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VehiclesBrowser() {
  const { data, mutate, isLoading } = useSWR<{ items: Vehicle[] }>("/api/vehicles", fetcher);
  const vehicles = data?.items ?? [];
  const [name, setName] = useState("");
  const [reg, setReg] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), regNumber: reg.trim() }),
    });
    setName("");
    setReg("");
    mutate();
  };

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30 }}>Vehicles</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Service and fuel, tracked per vehicle.</p>

      <div className="card mt-7 flex flex-wrap gap-2" style={{ padding: 16 }}>
        <input type="text" placeholder="Vehicle, e.g. Honda City" value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1" style={{ minWidth: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
        <input type="text" placeholder="Reg. number (optional)" value={reg} onChange={(e) => setReg(e.target.value)}
          style={{ width: 160, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14 }} />
        <button className="btn btn-dark" onClick={add}>Add vehicle</button>
      </div>

      <div className="mt-8" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {isLoading ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>
        ) : vehicles.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 14 }}>No vehicles yet.</p>
        ) : (
          vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} onChange={() => mutate()} />)
        )}
      </div>
    </div>
  );
}
