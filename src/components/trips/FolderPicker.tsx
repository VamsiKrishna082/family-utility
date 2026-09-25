"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, Folder, FolderPlus, Loader2 } from "lucide-react";
import type { BrowseResponse } from "@/lib/types";
import { fetcher, Modal, send } from "@/components/trips/shared";

/**
 * Pick an Album folder (same tree the Album shows). "Use this folder" picks
 * the folder you're in; you can also make a new one here first.
 */
export function FolderPicker({ title, confirmLabel, onClose, onPick }: { title: string; confirmLabel: string; onClose: () => void; onPick: (folderId: string, name: string, isRoot: boolean) => void | Promise<void> }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const { data, isLoading, mutate } = useSWR<BrowseResponse>(`/api/browse?folder=${folderId ?? "root"}`, fetcher);
  const folders = (data?.entries ?? []).filter((e) => e.kind === "folder");
  const photos = (data?.entries ?? []).filter((e) => e.kind !== "folder").length;
  const crumbs = data?.crumbs ?? [];
  const here = crumbs.length ? crumbs[crumbs.length - 1].name : "Album";
  const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
  const isRoot = crumbs.length <= 1;

  const pick = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await onPick(data.folderId, here, isRoot);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!data || !newName.trim()) return;
    setBusy(true);
    try {
      const { folder } = await send<{ folder: { id: string } }>("/api/folders", "POST", { name: newName.trim(), parentId: data.folderId });
      setNewName("");
      await mutate();
      setFolderId(folder.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex items-center gap-2 mb-3">
        {crumbs.length > 1 && (
          <button onClick={() => setFolderId(parentId)} className="btn btn-plain" style={{ padding: "5px 8px" }} aria-label="Up one folder"><ChevronLeft size={15} /></button>
        )}
        <p className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>{crumbs.map((c) => c.name).join(" / ") || "Album"}</p>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--line2)", borderRadius: 12 }}>
        {isLoading && <p className="flex items-center gap-2 p-3" style={{ fontSize: 13, color: "var(--faint)" }}><Loader2 size={14} className="spin" /> Loading</p>}
        {!isLoading && folders.length === 0 && <p className="p-3" style={{ fontSize: 13, color: "var(--faint)" }}>No folders inside{photos ? ` · ${photos} photos here` : ""}.</p>}
        {folders.map((f) => (
          <button key={f.id} onClick={() => setFolderId(f.id)} className="flex items-center gap-2 w-full text-left px-3 py-2.5" style={{ borderTop: "1px solid var(--line2)", fontSize: 14 }}>
            <Folder size={16} color="var(--faint)" /> {f.name}
          </button>
        ))}
      </div>
      <div className="flex mt-3" style={{ gap: 8 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder={`New folder in ${here}`} aria-label="New folder name" style={{ flex: 1, minWidth: 0, borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 14 }} />
        <button className="btn btn-plain flex items-center gap-1" onClick={create} disabled={!newName.trim() || busy}><FolderPlus size={15} /> Create</button>
      </div>
      <button className="btn btn-dark w-full mt-3" onClick={pick} disabled={busy || !data}>{confirmLabel}{isRoot ? "" : ` · ${here}`}</button>
    </Modal>
  );
}
