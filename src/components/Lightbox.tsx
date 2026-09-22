"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, Trash2, Pencil, Star, Move, Play, Pause } from "lucide-react";
import type { Entry } from "@/lib/types";

const SLIDESHOW_MS = 4000;

export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
  onDelete,
  onRename,
  onToggleFavorite,
  onMove,
}: {
  items: Entry[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  onDelete?: (item: Entry) => void | Promise<void>;
  onRename?: (item: Entry, name: string) => void | Promise<void>;
  onToggleFavorite?: (item: Entry) => void | Promise<void>;
  onMove?: (item: Entry) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [playing, setPlaying] = useState(false);
  const item = items[index];
  const touchStartX = useRef<number | null>(null);

  // A rename in progress shouldn't survive navigating to a different photo.
  useEffect(() => setEditing(false), [index]);

  // Playing stops itself the moment there's nowhere left to advance to, rather
  // than looping back to the start unannounced.
  useEffect(() => {
    if (index >= items.length - 1) setPlaying(false);
  }, [index, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, items.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onClose, onIndex, editing]);

  // Photos advance on a timer; a video instead waits for its own onEnded
  // below so autoplay doesn't cut a clip off mid-way.
  useEffect(() => {
    if (!playing || item?.kind === "video") return;
    const t = setTimeout(() => onIndex(Math.min(index + 1, items.length - 1)), SLIDESHOW_MS);
    return () => clearTimeout(t);
  }, [playing, index, items.length, item?.kind, onIndex]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return; // a tap, not a swipe
    if (dx < 0) onIndex(Math.min(index + 1, items.length - 1));
    else onIndex(Math.max(index - 1, 0));
  };

  if (!item) return null;

  const saveRename = async () => {
    const name = draftName.trim();
    setEditing(false);
    if (name && name !== item.name && onRename) await onRename(item, name);
  };

  const startRename = () => {
    setDraftName(item.name);
    setEditing(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(24,20,30,.94)" }}>
      <div className="flex items-center justify-between px-6 py-5">
        <button onClick={onClose} aria-label="Close" className="icon-plain"><X size={22} color="#fff" /></button>
        <div className="flex items-center gap-5">
          <span style={{ color: "rgba(255,255,255,.55)", fontSize: 13 }}>
            {index + 1} of {items.length}
          </span>
          {items.length > 1 && (
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              title={playing ? "Pause slideshow" : "Play slideshow"}
              className="icon-plain"
            >
              {playing ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
            </button>
          )}
          <a href={`/api/stream/${item.id}`} download={item.name} aria-label="Download" className="icon-plain">
            <Download size={19} color="#fff" />
          </a>
          {onMove && (
            <button onClick={() => onMove(item)} aria-label="Move to a different folder" title="Move to a different folder" className="icon-plain">
              <Move size={18} color="#fff" />
            </button>
          )}
          {onToggleFavorite && (
            <button onClick={() => onToggleFavorite(item)} aria-label={item.starred ? "Remove from favourites" : "Add to favourites"} className="icon-plain">
              <Star size={19} fill={item.starred ? "#ffc84a" : "none"} stroke={item.starred ? "#ffc84a" : "#fff"} strokeWidth={1.8} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={async () => {
                setDeleting(true);
                await onDelete(item);
              }}
              disabled={deleting}
              aria-label="Delete"
              className="icon-plain"
            >
              <Trash2 size={19} color="#fff" style={{ opacity: deleting ? 0.5 : 1 }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-4 gap-3">
        <button onClick={() => onIndex(Math.max(index - 1, 0))} disabled={index === 0} aria-label="Previous" className="icon-plain">
          <ChevronLeft size={26} color={index === 0 ? "rgba(255,255,255,.2)" : "#fff"} />
        </button>

        <div
          className="flex-1 flex items-center justify-center"
          style={{ maxHeight: "76vh" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {item.kind === "video" ? (
            <video
              key={item.id}
              src={`/api/stream/${item.id}`}
              poster={`/api/thumb/${item.id}?w=1600`}
              controls
              autoPlay
              playsInline
              onEnded={() => { if (playing) onIndex(Math.min(index + 1, items.length - 1)); }}
              style={{ maxHeight: "76vh", maxWidth: "100%", borderRadius: 14, background: "#000" }}
            />
          ) : (
            <img
              key={item.id}
              src={`/api/thumb/${item.id}?w=1600`}
              alt={item.name}
              style={{ maxHeight: "76vh", maxWidth: "100%", borderRadius: 14, objectFit: "contain" }}
            />
          )}
        </div>

        <button
          onClick={() => onIndex(Math.min(index + 1, items.length - 1))}
          disabled={index === items.length - 1}
          aria-label="Next"
          className="icon-plain"
        >
          <ChevronRight size={26} color={index === items.length - 1 ? "rgba(255,255,255,.2)" : "#fff"} />
        </button>
      </div>

      <div className="px-6 pb-7">
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="display"
            style={{
              fontSize: 18, color: "#fff", background: "transparent",
              border: "none", borderBottom: "1px solid rgba(255,255,255,.4)", outline: "none",
              width: "100%", maxWidth: 420,
            }}
          />
        ) : (
          <button onClick={startRename} className="flex items-center gap-2" disabled={!onRename}>
            <p className="display" style={{ fontSize: 18, color: "#fff" }}>{item.name}</p>
            {onRename && <Pencil size={13} color="rgba(255,255,255,.5)" />}
          </button>
        )}
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 13, marginTop: 3 }}>
          {new Date(item.createdTime).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
