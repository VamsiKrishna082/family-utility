"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { REMINDER_KIND_LABEL } from "@/lib/reminders";

type Prefs = { dates: boolean; documents: boolean; trips: boolean; money: boolean; food: boolean };
type State = "loading" | "unsupported" | "ios-install" | "server-off" | "blocked" | "off" | "on";
const LABEL: Record<keyof Prefs, string> = { ...REMINDER_KIND_LABEL, food: "“Log dinner?” at 8:30 PM" };

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong");
  return j as T;
}

/**
 * Reminders for this device: a short note at 8 AM when something's coming
 * up (birthdays, renewals, trips, card dues) and an optional "log dinner?"
 * at 8:30 PM. Each device opts in separately, with its own choices.
 */
export function ReminderSettings() {
  const [state, setState] = useState<State>("loading");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const info = await api<{ configured: boolean; subscribed: boolean; prefs: Prefs }>(`/api/push${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ""}`);
      setPrefs(info.prefs);
      if (!info.configured) return setState("server-off");
      if (Notification.permission === "denied") return setState("blocked");
      if (sub && info.subscribed) { setEndpoint(sub.endpoint); return setState("on"); }
      setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource }));
      const device = /iphone|ipad/i.test(navigator.userAgent) ? "iPhone" : /android/i.test(navigator.userAgent) ? "Android phone" : "Computer";
      const res = await api<{ prefs: Prefs }>("/api/push", "POST", { subscription: sub.toJSON(), device });
      setPrefs(res.prefs);
      setEndpoint(sub.endpoint);
      setState("on");
      setNote("Reminders are on for this device.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't turn reminders on");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await api("/api/push", "DELETE", { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setEndpoint(null);
      setState("off");
      setNote("Reminders are off for this device.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (k: keyof Prefs) => {
    if (!prefs || !endpoint) return;
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try { await api("/api/push", "PATCH", { endpoint, prefs: { [k]: next[k] } }); } catch { setPrefs(prefs); }
  };

  const test = async (preview: boolean) => {
    if (!endpoint) return;
    setBusy(true);
    setNote("");
    try {
      const r = await api<{ title: string }>("/api/push/test", "POST", { endpoint, preview });
      setNote(preview ? `Sent: “${r.title}” — check your notifications.` : "Sent — it should appear in a few seconds.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  };

  const text: Partial<Record<State, string>> = {
    unsupported: "This browser can't show reminders. Chrome, Edge, Firefox and Safari (on an installed app) can.",
    "ios-install": "On iPhone, reminders work once the app is installed: tap Share → “Add to Home Screen”, open it from there, and come back here.",
    "server-off": "Reminders aren't switched on for the app yet (the server needs its push keys).",
    blocked: "Notifications are blocked for this site. Allow them in the browser's site settings, then reload.",
    off: "Get a short note at 8 AM when a birthday, a renewal, a trip or a card bill is coming up — on this device.",
  };

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <p className="display flex items-center gap-2" style={{ fontSize: 19 }}>
          {state === "on" ? <Bell size={18} color="var(--green)" /> : <BellOff size={18} color="var(--faint)" />} Reminders
        </p>
        {state === "off" && <button className="btn btn-dark" onClick={turnOn} disabled={busy}>{busy ? <Loader2 size={15} className="spin" /> : "Turn on for this device"}</button>}
        {state === "on" && <button className="btn btn-plain" onClick={turnOff} disabled={busy}>Turn off</button>}
      </div>
      {state === "loading" && <p style={{ fontSize: 13.5, color: "var(--faint)", marginTop: 8 }}>Checking…</p>}
      {text[state] && <p style={{ fontSize: 13.5, color: "var(--dim)", marginTop: 8 }}>{text[state]}</p>}

      {state === "on" && prefs && (
        <>
          <div style={{ display: "grid", gap: 2, marginTop: 12 }}>
            {(Object.keys(LABEL) as (keyof Prefs)[]).map((k) => (
              <label key={k} className="flex items-center justify-between" style={{ padding: "9px 0", borderTop: "1px solid var(--line2)", fontSize: 14 }}>
                {LABEL[k]}
                <input type="checkbox" checked={prefs[k]} onChange={() => toggle(k)} style={{ width: 20, height: 20, accentColor: "var(--green)" }} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-plain flex items-center gap-1.5" onClick={() => test(false)} disabled={busy}><Send size={14} /> Send a test</button>
            <button className="btn btn-plain" onClick={() => test(true)} disabled={busy}>Preview this morning’s reminder</button>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 10 }}>
            Birthdays follow each date’s own “remind me” days. Renewals: 30, 14, 7, 3 and 1 days before. Trips: a week, 3 days and the day before. Card dues: on the 1st and 15th.
          </p>
        </>
      )}
      {note && <p style={{ fontSize: 13, color: "var(--green)", marginTop: 10 }}>{note}</p>}
    </section>
  );
}
