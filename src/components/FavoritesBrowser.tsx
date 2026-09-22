"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import type { Entry, FavoritesResponse } from "@/lib/types";
import { Thumb } from "@/components/Thumb";
import { Lightbox } from "@/components/Lightbox";
import { MoveDialog } from "@/components/MoveDialog";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load favourites");
  return r.json();
};

async function patchItem(id: string, folder: string, body: Record<string, unknown>) {
  await fetch(`/api/media/${id}?folder=${folder}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * A flat, virtual collection — not a real Drive folder. Every item here still
 * lives in its own album folder; this just filters the whole library down to
 * whatever is starred, same as search does for a name match.
 */
export function FavoritesBrowser() {
  const { data, error, isLoading, mutate } = useSWR<FavoritesResponse>("/api/favorites", fetcher, {
    revalidateOnFocus: false,
  });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Entry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const items = data?.results ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  };

  const removeFromList = (id: string) => {
    if (!data) return;
    mutate({ results: data.results.filter((e) => e.id !== id) }, false);
  };

  const handleDelete = async (item: Entry) => {
    setLightbox(null);
    removeFromList(item.id);
    await fetch(`/api/media/${item.id}?folder=${item.parentId ?? ""}`, { method: "DELETE" });
  };

  const handleRename = async (item: Entry, name: string) => {
    if (!data) return;
    mutate({ results: data.results.map((e) => (e.id === item.id ? { ...e, name } : e)) }, false);
    await patchItem(item.id, item.parentId ?? "", { name });
  };

  /** Every item on this page is starred, so any toggle here means "remove from favourites". */
  const handleUnfavorite = async (item: Entry) => {
    setLightbox(null);
    removeFromList(item.id);
    await patchItem(item.id, item.parentId ?? "", { starred: false });
  };

  /** Sets item's own parent folder's cover — invisible from here, same as in the main Album grid. */
  const setCover = async (item: Entry) => {
    if (!item.parentId) return;
    await patchItem(item.parentId, item.parentId, { cover: item.id });
    showToast("Set as folder cover");
  };

  // Moving doesn't touch the star, so the item stays a favourite and stays in
  // this list — just re-fetch afterward so its shown path catches up.
  const moveItem = async (destId: string, destName: string) => {
    const item = moveTarget;
    if (!item?.parentId) return;
    setMoveTarget(null);
    try {
      await patchItem(item.id, item.parentId, { moveTo: destId });
      showToast(`Moved to “${destName}”`);
    } finally {
      mutate();
    }
  };

  return (
    <div style={{ minHeight: "60vh" }}>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/album" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30, lineHeight: 1.15 }}>Favourites</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {items.length === 0 ? "Nothing favourited yet" : `${items.length} item${items.length === 1 ? "" : "s"}, from any folder`}
          </p>
        </div>
        <button className="btn btn-plain flex items-center justify-center shrink-0" onClick={refresh} disabled={refreshing} aria-label="Refresh">
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="card mb-6" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>
          {error.message}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center gap-2 py-16" style={{ color: "var(--faint)", fontSize: 14 }}>
          <Loader2 size={16} className="spin" /> Loading
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="display" style={{ fontSize: 20 }}>No favourites yet</p>
          <p style={{ color: "var(--faint)", fontSize: 14, marginTop: 8 }}>
            Hover any photo in Album and tap the star to add it here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {items.map((m, i) => (
            <div key={m.id}>
              <Thumb
                item={m}
                onOpen={() => setLightbox(i)}
                onDelete={() => handleDelete(m)}
                onToggleFavorite={() => handleUnfavorite(m)}
                onSetCover={() => setCover(m)}
                onMove={() => setMoveTarget(m)}
              />
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }} className="truncate">{m.path}</p>
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox
          items={items}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onDelete={handleDelete}
          onRename={handleRename}
          onToggleFavorite={handleUnfavorite}
          onMove={(item) => {
            setLightbox(null);
            setMoveTarget(item);
          }}
        />
      )}

      {moveTarget?.parentId && (
        <MoveDialog currentFolderId={moveTarget.parentId} onClose={() => setMoveTarget(null)} onConfirm={moveItem} />
      )}

      {toast && (
        <div
          className="card"
          style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 24, padding: "10px 18px", fontSize: 13.5, zIndex: 60 }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
