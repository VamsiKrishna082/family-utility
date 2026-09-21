"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, WifiOff, Save } from "lucide-react";
import type { EmergencyCard, EmergencyContact } from "@/lib/types";

const CACHE_KEY = "household:emergency-card";

const EMPTY: EmergencyCard = {
  bloodType: { vamsi: "", partner: "" },
  allergies: "",
  address: "",
  contacts: [],
  doctor: "",
  insurance: "",
  updatedAt: 0,
};

const field: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14,
};

export function EmergencyBrowser() {
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // This page exists for the moment the internet or Drive is the problem — so on load,
  // try the network first, but fall back to whatever was cached from the last successful
  // load rather than showing a blank page. On a successful save, refresh that cache.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/emergency");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as EmergencyCard;
        setCard(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          setCard(JSON.parse(cached));
          setOffline(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/emergency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!res.ok) throw new Error();
      localStorage.setItem(CACHE_KEY, JSON.stringify(card));
      setOffline(false);
      setSavedAt(Date.now());
    } catch {
      // Can't reach the server — at least keep this device's copy current.
      localStorage.setItem(CACHE_KEY, JSON.stringify(card));
    } finally {
      setSaving(false);
    }
  };

  const addContact = () =>
    setCard((c) => ({ ...c, contacts: [...c.contacts, { id: crypto.randomUUID(), name: "", relation: "", phone: "" }] }));
  const updateContact = (id: string, patch: Partial<EmergencyContact>) =>
    setCard((c) => ({ ...c, contacts: c.contacts.map((ct) => (ct.id === id ? { ...ct, ...patch } : ct)) }));
  const removeContact = (id: string) =>
    setCard((c) => ({ ...c, contacts: c.contacts.filter((ct) => ct.id !== id) }));

  if (loading) return <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: 30 }}>Emergency</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>In case of. Kept on this device too, for when it matters most.</p>

      {offline && (
        <div className="card mt-5 flex items-center gap-2" style={{ padding: 12, background: "#fdf4e8", borderColor: "#e8d5b0" }}>
          <WifiOff size={15} color="var(--amber)" />
          <span style={{ fontSize: 13, color: "var(--amber)" }}>Showing the copy saved on this device — couldn&apos;t reach the server.</span>
        </div>
      )}

      <div className="card mt-6" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Blood type</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label style={{ fontSize: 12.5, color: "var(--faint)" }}>Vamsi</label>
            <input style={field} value={card.bloodType.vamsi} onChange={(e) => setCard((c) => ({ ...c, bloodType: { ...c.bloodType, vamsi: e.target.value } }))} />
          </div>
          <div className="flex-1">
            <label style={{ fontSize: 12.5, color: "var(--faint)" }}>Partner</label>
            <input style={field} value={card.bloodType.partner} onChange={(e) => setCard((c) => ({ ...c, bloodType: { ...c.bloodType, partner: e.target.value } }))} />
          </div>
        </div>
      </div>

      <div className="card mt-4" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Allergies</p>
        <textarea style={{ ...field, minHeight: 60 }} value={card.allergies} onChange={(e) => setCard((c) => ({ ...c, allergies: e.target.value }))} />
      </div>

      <div className="card mt-4" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Home address</p>
        <textarea style={{ ...field, minHeight: 60 }} value={card.address} onChange={(e) => setCard((c) => ({ ...c, address: e.target.value }))} />
      </div>

      <div className="card mt-4" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.4 }}>Emergency contacts</p>
          <button className="btn btn-plain flex items-center gap-1" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={addContact}><Plus size={13} /> Add</button>
        </div>
        {card.contacts.length === 0 && <p style={{ color: "var(--faint)", fontSize: 13.5 }}>None added.</p>}
        {card.contacts.map((ct) => (
          <div key={ct.id} className="flex gap-2 mb-2">
            <input style={field} placeholder="Name" value={ct.name} onChange={(e) => updateContact(ct.id, { name: e.target.value })} />
            <input style={{ ...field, width: 110 }} placeholder="Relation" value={ct.relation} onChange={(e) => updateContact(ct.id, { relation: e.target.value })} />
            <input style={{ ...field, width: 140 }} placeholder="Phone" value={ct.phone} onChange={(e) => updateContact(ct.id, { phone: e.target.value })} />
            <button onClick={() => removeContact(ct.id)} style={{ color: "var(--faint)" }} aria-label="Remove"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="card mt-4" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Doctor</p>
        <input style={field} value={card.doctor} onChange={(e) => setCard((c) => ({ ...c, doctor: e.target.value }))} />
      </div>

      <div className="card mt-4" style={{ padding: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Insurance</p>
        <input style={field} value={card.insurance} onChange={(e) => setCard((c) => ({ ...c, insurance: e.target.value }))} />
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button className="btn btn-dark flex items-center gap-2" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && <span style={{ fontSize: 13, color: "var(--green)" }}>Saved</span>}
      </div>
    </div>
  );
}
