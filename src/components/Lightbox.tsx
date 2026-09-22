"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, Trash2, Pencil, Star } from "lucide-react";
import type { Entry } from "@/lib/types";

export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
  onDelete,
  onRename,
  onToggleFavorite,
}: {
  items: Entry[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  onDelete?: (item: Entry) => void | Promise<void>;
  onRename?: (item: Entry, name: string) => void | Promise<void>;
  onToggleFavorite?: (item: Entry) => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const item = items[index];

  // A rename in progress shouldn't survive navigating to a different photo.
  useEffect(() => setEditing(false), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(index + 1, items.length - 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onClose, onIndex, editing]);

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
        <button onClick={onClose} aria-label="Close"><X size={22} color="#fff" /></button>
        <div className="flex items-center gap-5">
          <span style={{ color: "rgba(255,255,255,.55)", fontSize: 13 }}>
            {index + 1} of {items.length}
          </span>
          <a href={`/api/stream/${item.id}`} download={item.name} aria-label="Download">
            <Download size={19} color="#fff" />
          </a>
          {onToggleFavorite && (
            <button onClick={() => onToggleFavorite(item)} aria-label={item.starred ? "Remove from favourites" : "Add to favourites"}>
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
            >
              <Trash2 size={19} color="#fff" style={{ opacity: deleting ? 0.5 : 1 }} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-4 gap-3">
        <button onClick={() => onIndex(Math.max(index - 1, 0))} disabled={index === 0} aria-label="Previous">
          <ChevronLeft size={26} color={index === 0 ? "rgba(255,255,255,.2)" : "#fff"} />
        </button>

        <div className="flex-1 flex items-center justify-center" style={{ maxHeight: "76vh" }}>
          {item.kind === "video" ? (
            <video
              key={item.id}
              src={`/api/stream/${item.id}`}
              poster={`/api/thumb/${item.id}?w=1600`}
              controls
              autoPlay
              playsInline
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
