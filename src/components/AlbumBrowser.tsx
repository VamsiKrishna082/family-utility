"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Folder, FolderPlus, Upload, Loader2, RefreshCw } from "lucide-react";
import type { BrowseResponse, Entry } from "@/lib/types";
import { uploadOne, type UploadProgress } from "@/lib/upload";
import { Thumb } from "@/components/Thumb";
import { Lightbox } from "@/components/Lightbox";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load this folder");
  return r.json();
};

export function AlbumBrowser({ folderId }: { folderId: string | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const key = `/api/browse?folder=${folderId ?? "root"}`;

  // One request for breadcrumbs, folders and media. Keeps the previous folder on
  // screen while the next loads, so navigation never flashes empty.
  const { data, error, isLoading, mutate } = useSWR<BrowseResponse>(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const folders = useMemo(() => data?.entries.filter((e) => e.kind === "folder") ?? [], [data]);
  const media = useMemo(() => data?.entries.filter((e) => e.kind !== "folder") ?? [], [data]);
  const crumbs = data?.crumbs ?? [];
  const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
  const here = crumbs.length ? crumbs[crumbs.length - 1].name : "Album";

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      const chosen = Array.from(list);
      setUploads(chosen.map((f) => ({ name: f.name, percent: 0, state: "uploading" as const })));

      const queue = [...chosen.entries()];
      const worker = async () => {
        for (;;) {
          const next = queue.shift();
          if (!next) return;
          const [i, file] = next;
          try {
            await uploadOne(file, folderId, (pct) =>
              setUploads((u) => u.map((x, j) => (j === i ? { ...x, percent: pct } : x))),
            );
            setUploads((u) => u.map((x, j) => (j === i ? { ...x, percent: 100, state: "done" } : x)));
          } catch (err) {
            setUploads((u) =>
              u.map((x, j) =>
                j === i ? { ...x, state: "error", error: err instanceof Error ? err.message : "Failed" } : x,
              ),
            );
          }
        }
      };
      await Promise.all([worker(), worker()]);

      await mutate();
      setTimeout(() => setUploads([]), 2500);
    },
    [folderId, mutate],
  );

  const createFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setCreating(false);
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: folderId }),
    });
    mutate();
  };

  const openAt = (item: Entry) => setLightbox(media.findIndex((m) => m.id === item.id));

  /** Trashes in Drive (recoverable there), removing the tile immediately rather than waiting on SWR's revalidation. */
  const handleDelete = useCallback(
    async (item: Entry) => {
      if (!data) return;
      const target = data.folderId;
      await mutate({ ...data, entries: data.entries.filter((e) => e.id !== item.id) }, false);
      try {
        await fetch(`/api/media/${item.id}?folder=${target}`, { method: "DELETE" });
      } finally {
        mutate();
      }
    },
    [data, mutate],
  );

  const deleteFromLightbox = async (item: Entry) => {
    setLightbox(null); // back to the grid — simplest correct behavior, no index juggling
    await handleDelete(item);
  };

  /** Bypasses the 60s cache so a file added directly in Drive (not through this app) shows up right away. */
  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetcher(`/api/browse?folder=${folderId ?? "root"}&refresh=1`);
      await mutate(res, false);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      style={{
        minHeight: "60vh",
        outline: dragging ? "2px dashed var(--green)" : "none",
        outlineOffset: 12,
        borderRadius: 8,
      }}
    >
      <div className="flex items-start gap-4 mb-7">
        {crumbs.length > 0 && (
          <Link
            href={parentId ? `/album?folder=${parentId}` : "/album"}
            className="flex items-center justify-center shrink-0 card"
            style={{ width: 38, height: 38, borderRadius: 12 }}
          >
            <ChevronLeft size={19} />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="display" style={{ fontSize: 30, lineHeight: 1.15 }}>{here}</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {crumbs.length === 0
              ? "Everything, in folders"
              : ["Album", ...crumbs.map((c) => c.name)].join("  ›  ")}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button className="btn btn-plain flex items-center justify-center" onClick={refresh} disabled={refreshing} aria-label="Refresh" title="Check Drive for anything added outside the app">
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>
          <button className="btn btn-plain flex items-center gap-2" onClick={() => setCreating((v) => !v)}>
            <FolderPlus size={16} /> <span className="hidden sm:inline">New folder</span>
          </button>
          <button className="btn btn-dark flex items-center gap-2" onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> <span className="hidden sm:inline">Upload</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {creating && (
        <div className="card flex gap-2 mb-6" style={{ padding: 12, maxWidth: 460 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
            placeholder="Folder name, for example Coorg 2026"
            className="flex-1 px-3 py-2 outline-none"
            style={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 14.5 }}
          />
          <button className="btn btn-dark" onClick={createFolder}>Create</button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="card mb-6" style={{ padding: 16, maxWidth: 560 }}>
          {uploads.map((u) => (
            <div key={u.name} className="mb-3 last:mb-0">
              <div className="flex justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
                <span className="truncate" style={{ color: "var(--ink)" }}>{u.name}</span>
                <span style={{ color: u.state === "error" ? "var(--red)" : "var(--faint)" }}>
                  {u.state === "error" ? u.error : u.state === "done" ? "Done" : `${u.percent}%`}
                </span>
              </div>
              <div style={{ height: 4, background: "var(--line2)", borderRadius: 4 }}>
                <div
                  style={{
                    height: 4,
                    width: `${u.percent}%`,
                    background: u.state === "error" ? "var(--red)" : "var(--green)",
                    borderRadius: 4,
                    transition: "width .2s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card mb-6" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>
          {error.message}
        </div>
      )}

      {folders.length > 0 && (
        <div
          className="mb-8"
          style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
        >
          {folders.map((f) => (
            <Link key={f.id} href={`/album?folder=${f.id}`} className="card" style={{ padding: 18, display: "block" }}>
              <Folder size={19} color="#3e6b85" strokeWidth={1.8} />
              <p style={{ fontSize: 15, marginTop: 14 }} className="truncate">{f.name}</p>
            </Link>
          ))}
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center gap-2 py-16" style={{ color: "var(--faint)", fontSize: 14 }}>
          <Loader2 size={16} className="spin" /> Loading
        </div>
      ) : media.length === 0 && folders.length === 0 ? (
        <div className="py-20 text-center">
          <p className="display" style={{ fontSize: 20 }}>Nothing here yet</p>
          <p style={{ color: "var(--faint)", fontSize: 14, marginTop: 8 }}>
            Drag photos anywhere on this page, or make a folder first.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {media.map((m) => (
            <Thumb key={m.id} item={m} onOpen={() => openAt(m)} onDelete={() => handleDelete(m)} />
          ))}
        </div>
      )}

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox items={media} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} onDelete={deleteFromLightbox} />
      )}
    </div>
  );
}
