"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, Folder, Loader2, X } from "lucide-react";
import type { BrowseResponse } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load folders");
  return r.json();
};

/**
 * A small folder picker for "Move to…". Browses the same tree as the album
 * itself (reuses /api/browse, so it shares its cache and its 60s TTL), but
 * only ever shows folders — media in the folder being browsed is irrelevant
 * to picking a destination.
 */
export function MoveDialog({
  currentFolderId,
  onClose,
  onConfirm,
}: {
  /** Where the item(s) already are — picking this folder again would be a no-op. */
  currentFolderId: string;
  onClose: () => void;
  onConfirm: (destFolderId: string, destName: string) => void | Promise<void>;
}) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const key = `/api/browse?folder=${folderId ?? "root"}`;
  const { data, isLoading } = useSWR<BrowseResponse>(key, fetcher);

  const folders = (data?.entries ?? []).filter((e) => e.kind === "folder");
  const crumbs = data?.crumbs ?? [];
  const here = crumbs.length ? crumbs[crumbs.length - 1].name : "Album";
  const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
  const resolvedHereId = data?.folderId ?? null;
  const isCurrent = resolvedHereId === currentFolderId;

  const confirm = async () => {
    if (!resolvedHereId || isCurrent) return;
    setMoving(true);
    try {
      await onConfirm(resolvedHereId, here);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(24,20,30,.5)" }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 420, maxWidth: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          {crumbs.length > 0 && (
            <button
              onClick={() => setFolderId(parentId)}
              aria-label="Back"
              className="flex items-center justify-center shrink-0"
              style={{ width: 30, height: 30, borderRadius: 9, background: "var(--line2)" }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <p className="display truncate" style={{ fontSize: 16, flex: 1 }}>Move to “{here}”?</p>
          <button onClick={onClose} aria-label="Close" className="shrink-0"><X size={18} color="var(--faint)" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 px-3" style={{ color: "var(--faint)", fontSize: 14 }}>
              <Loader2 size={15} className="spin" /> Loading
            </div>
          ) : folders.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 13.5, padding: "24px 12px", textAlign: "center" }}>
              No subfolders here
            </p>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setFolderId(f.id)}
                className="flex items-center gap-2.5 w-full text-left"
                style={{ padding: "10px 12px", borderRadius: 10, fontSize: 14.5 }}
              >
                <Folder size={16} color="#3e6b85" strokeWidth={1.8} />
                <span className="truncate">{f.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--line)" }}>
          <button className="btn btn-plain" style={{ padding: "8px 14px", fontSize: 13.5 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-dark"
            style={{ padding: "8px 14px", fontSize: 13.5, opacity: isCurrent ? 0.4 : 1 }}
            onClick={confirm}
            disabled={isCurrent || moving || !resolvedHereId}
          >
            {moving ? "Moving…" : isCurrent ? "Already here" : `Move here`}
          </button>
        </div>
      </div>
    </div>
  );
}
