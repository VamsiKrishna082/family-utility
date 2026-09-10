"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Entry } from "@/lib/types";

export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: Entry[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;

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
        <p className="display" style={{ fontSize: 18, color: "#fff" }}>{item.name}</p>
        <p style={{ color: "rgba(255,255,255,.55)", fontSize: 13, marginTop: 3 }}>
          {new Date(item.createdTime).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
