"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import { ART_LABEL, ART_THEMES, artTheme } from "@/lib/trips/art";
import type { Trip } from "@/lib/trips/types";

/**
 * Shrinks a picked photo in the browser before upload (phones take 12 MP+
 * pictures; 2400px is plenty for a cover and a printed journal). Falls back
 * to the original file if the browser can't decode it.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** "Cover" button over the trip's cover: illustrated destination art, your own image, or remove it. */
export function CoverPicker({ trip, onChanged }: { trip: Trip; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setOpen(false);
    try {
      const body = await shrink(file);
      const res = await fetch(`/api/trips/${trip.id}/cover`, { method: "POST", headers: { "Content-Type": body.type || file.type }, body });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't upload the cover");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the cover");
    } finally {
      setBusy(false);
    }
  };

  const useArt = async (coverArt: NonNullable<Trip["coverArt"]>) => {
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverArt }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't change the cover");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the cover");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setOpen(false);
    setBusy(true);
    try {
      await fetch(`/api/trips/${trip.id}/cover`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const showingArt = !trip.coverImage && !trip.coverPhotoId;
  const pill = { background: "rgba(255,255,255,.92)", color: "var(--ink)", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,.12)" } as const;

  return (
    <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <button className="flex items-center gap-1.5" style={pill} onClick={() => setOpen((v) => !v)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {busy ? "Saving…" : "Cover"}
      </button>
      {open && (
        <div role="menu" className="card" style={{ padding: 6, width: 250, color: "var(--ink)" }}>
          <p className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", padding: "4px 6px" }}><Palette size={13} /> Illustrated art</p>
          <div className="flex flex-wrap" style={{ gap: 6, padding: "2px 6px 8px" }}>
            {(["auto", ...ART_THEMES] as const).map((t) => {
              const on = showingArt && (trip.coverArt ?? "auto") === t;
              return (
                <button key={t} role="menuitemradio" aria-checked={on} onClick={() => useArt(t)} className="flex items-center gap-1"
                  style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`, background: on ? "var(--ink)" : "var(--card)", color: on ? "#fff" : "var(--ink)" }}>
                  {on && <Check size={12} />}{t === "auto" ? `Auto · ${ART_LABEL[artTheme(trip.destination, trip.name)]}` : ART_LABEL[t]}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 4 }}>
            <button role="menuitem" className="flex items-center gap-2 w-full" style={{ padding: "8px 10px", fontSize: 13.5, textAlign: "left" }} onClick={() => input.current?.click()}>
              <ImagePlus size={14} /> {trip.coverImage ? "Upload a different image" : "Upload your own image"}
            </button>
            {trip.coverImage && (
              <button role="menuitem" className="flex items-center gap-2 w-full" style={{ padding: "8px 10px", fontSize: 13.5, textAlign: "left", color: "var(--red)" }} onClick={remove}>
                <Trash2 size={14} /> Remove my image
              </button>
            )}
            <p style={{ fontSize: 11.5, color: "var(--faint)", padding: "4px 10px 6px" }}>Or tap ☆ on any day photo in the Journey tab.</p>
          </div>
        </div>
      )}
      {error && <span style={{ ...pill, color: "var(--red)", fontWeight: 500, maxWidth: 260 }}>{error}</span>}
    </div>
  );
}
