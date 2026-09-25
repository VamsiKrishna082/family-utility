"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Trash2 } from "lucide-react";
import type { VoiceNote } from "@/lib/trips/types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The first recording format this browser supports (Chrome/Firefox: webm/opus, Safari: mp4/aac). */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
}

/**
 * Record the day's story out loud instead of typing it. Recordings go to
 * the app's cloud storage (not the Album), up to ~10 minutes each.
 */
export function VoiceNotes({ tripId, day, notes, onChanged }: { tripId: string; day: number; notes: VoiceNote[]; onChanged: () => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    setError("");
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) return setError("This browser can't record audio.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = (Date.now() - started.current) / 1000;
        const blob = new Blob(chunks.current, { type: mime });
        setBusy(true);
        try {
          const res = await fetch(`/api/trips/${tripId}/days/${day}/voice`, {
            method: "POST",
            headers: { "Content-Type": mime.split(";")[0], "x-duration": String(Math.round(duration)) },
            body: blob,
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save the recording");
          onChanged();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save the recording");
        } finally {
          setBusy(false);
        }
      };
      r.start(1000);
      rec.current = r;
      started.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setSeconds(s);
        if (s >= 600) stop(); // 10 min cap
      }, 250);
    } catch {
      setError("Microphone access was blocked.");
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/trips/${tripId}/days/${day}/voice?note=${id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div>
      <div className="flex items-center" style={{ gap: 10 }}>
        {recording ? (
          <button className="btn flex items-center gap-1.5" style={{ background: "var(--red)", color: "#fff", padding: "6px 12px", fontSize: 13 }} onClick={stop}>
            <Square size={12} fill="#fff" /> Stop · {fmt(seconds)}
          </button>
        ) : (
          <button className="btn btn-plain flex items-center gap-1.5" style={{ padding: "6px 12px", fontSize: 13 }} onClick={start} disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <Mic size={13} />} {busy ? "Saving…" : "Record a voice note"}
          </button>
        )}
        {error && <span style={{ fontSize: 12.5, color: "var(--red)" }}>{error}</span>}
      </div>
      {notes.map((n) => (
        <div key={n.id} className="flex items-center gap-2 mt-2">
          <audio controls preload="none" src={`/api/trips/${tripId}/days/${day}/voice?note=${n.id}`} style={{ height: 34, flex: 1, minWidth: 0 }} />
          <span style={{ fontSize: 12, color: "var(--faint)", flexShrink: 0 }}>{fmt(n.durationSec)}</span>
          <button onClick={() => remove(n.id)} aria-label="Delete voice note"><Trash2 size={14} color="var(--faint)" /></button>
        </div>
      ))}
    </div>
  );
}
