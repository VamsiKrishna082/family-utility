"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
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

/** "Cover" button over the trip's cover: upload your own image, or remove it. */
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

  const pill = { background: "rgba(255,255,255,.92)", color: "var(--ink)", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,.12)" } as const;

  return (
    <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <button className="flex items-center gap-1.5" style={pill} onClick={() => (trip.coverImage ? setOpen((v) => !v) : input.current?.click())} disabled={busy} aria-haspopup={trip.coverImage ? "menu" : undefined}>
        {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {busy ? "Uploading…" : "Cover"}
      </button>
      {open && (
        <div role="menu" className="card" style={{ padding: 4, minWidth: 190 }}>
          <button role="menuitem" className="flex items-center gap-2 w-full" style={{ padding: "8px 10px", fontSize: 13.5, textAlign: "left" }} onClick={() => input.current?.click()}>
            <ImagePlus size={14} /> Upload a different image
          </button>
          <button role="menuitem" className="flex items-center gap-2 w-full" style={{ padding: "8px 10px", fontSize: 13.5, textAlign: "left", color: "var(--red)" }} onClick={remove}>
            <Trash2 size={14} /> Remove my image
          </button>
        </div>
      )}
      {error && <span style={{ ...pill, color: "var(--red)", fontWeight: 500, maxWidth: 260 }}>{error}</span>}
    </div>
  );
}
