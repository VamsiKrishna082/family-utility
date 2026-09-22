"use client";

import { useEffect, useState } from "react";
import { Play, Trash2, Check, Star } from "lucide-react";
import type { Entry } from "@/lib/types";

/**
 * Drive needs a few seconds to render a thumbnail for a freshly uploaded file.
 * The proxy answers 202 until then, so we retry with backoff instead of showing a broken tile.
 */
export function Thumb({
  item,
  onOpen,
  onDelete,
  onToggleFavorite,
  selectMode,
  selected,
  onToggleSelect,
}: {
  item: Entry;
  onOpen: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  const src = `/api/thumb/${item.id}?w=520${attempt ? `&r=${attempt}` : ""}`;

  useEffect(() => {
    if (loaded || gaveUp || attempt > 8) return;
    // Only schedules a retry while the image has not arrived.
    const t = setTimeout(() => {
      if (!loaded) setAttempt((a) => (a >= 8 ? (setGaveUp(true), a) : a + 1));
    }, 2500 + attempt * 1500);
    return () => clearTimeout(t);
  }, [attempt, loaded, gaveUp]);

  return (
    <div className="group relative w-full overflow-hidden" style={{ borderRadius: 14, background: "var(--line2)", aspectRatio: "4 / 3" }}>
      <button
        onClick={selectMode ? onToggleSelect : onOpen}
        className="absolute inset-0 w-full h-full"
        style={selected ? { outline: "2.5px solid var(--indigo)", outlineOffset: -2.5, borderRadius: 14 } : undefined}
      >
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`fade-in ${loaded ? "loaded" : ""}`}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />

        {!loaded && !gaveUp && <span className="shimmer" style={{ position: "absolute", inset: 0 }} />}

        {gaveUp && (
          <span
            className="absolute inset-0 flex items-center justify-center px-3 text-center"
            style={{ color: "var(--faint)", fontSize: 12 }}
          >
            Drive is still processing this one
          </span>
        )}

        {item.kind === "video" && (
          <span
            className="absolute flex items-center gap-1 px-1.5 py-0.5"
            style={{ top: 8, right: 8, background: "rgba(10,8,16,.5)", color: "#fff", fontSize: 10.5, borderRadius: 6 }}
          >
            <Play size={9} fill="#fff" strokeWidth={0} />
            {item.durationLabel ?? "video"}
          </span>
        )}

        {selectMode && (
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: 8, left: 8, width: 22, height: 22, borderRadius: 999,
              background: selected ? "var(--indigo)" : "rgba(255,255,255,.85)",
              border: selected ? "none" : "1.5px solid rgba(0,0,0,.2)",
            }}
          >
            {selected && <Check size={13} color="#fff" strokeWidth={2.5} />}
          </span>
        )}
      </button>

      {onDelete && !selectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
          className="absolute opacity-0 group-hover:opacity-100 flex items-center justify-center"
          style={{
            top: 8, left: 8, width: 28, height: 28, borderRadius: 8,
            background: "rgba(10,8,16,.55)", transition: "opacity .15s ease",
          }}
        >
          <Trash2 size={13} color="#fff" strokeWidth={1.8} />
        </button>
      )}

      {onToggleFavorite && !selectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={item.starred ? "Remove from favourites" : "Add to favourites"}
          className={`absolute flex items-center justify-center ${item.starred ? "" : "opacity-0 group-hover:opacity-100"}`}
          style={{
            bottom: 8, right: 8, width: 28, height: 28, borderRadius: 8,
            background: "rgba(10,8,16,.55)", transition: "opacity .15s ease",
          }}
        >
          <Star size={13} color="#fff" fill={item.starred ? "#ffc84a" : "none"} stroke={item.starred ? "#ffc84a" : "#fff"} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
