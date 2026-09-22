"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ChevronLeft, Folder, FolderPlus, Upload, Loader2, RefreshCw,
  Search, X, Camera, CheckSquare, Trash2, Pencil,
} from "lucide-react";
import type { BrowseResponse, Entry, SearchResponse } from "@/lib/types";
import { uploadOne, type UploadProgress } from "@/lib/upload";
import { Thumb } from "@/components/Thumb";
import { Lightbox } from "@/components/Lightbox";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load this folder");
  return r.json();
};

async function patchItem(id: string, folder: string, body: Record<string, unknown>) {
  await fetch(`/api/media/${id}?folder=${folder}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AlbumBrowser({ folderId }: { folderId: string | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
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

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchLightbox, setSearchLightbox] = useState<number | null>(null);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const folders = useMemo(() => data?.entries.filter((e) => e.kind === "folder") ?? [], [data]);
  const media = useMemo(() => data?.entries.filter((e) => e.kind !== "folder") ?? [], [data]);
  const crumbs = data?.crumbs ?? [];
  const parentId = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null;
  const here = crumbs.length ? crumbs[crumbs.length - 1].name : "Album";

  const photoCount = useMemo(() => media.filter((m) => m.kind === "photo").length, [media]);
  const videoCount = useMemo(() => media.filter((m) => m.kind === "video").length, [media]);

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

  const renameFromLightbox = useCallback(
    async (item: Entry, name: string) => {
      if (!data) return;
      await mutate({ ...data, entries: data.entries.map((e) => (e.id === item.id ? { ...e, name } : e)) }, false);
      try {
        await patchItem(item.id, data.folderId, { name });
      } finally {
        mutate();
      }
    },
    [data, mutate],
  );

  const startFolderRename = (f: Entry) => {
    setRenamingFolderId(f.id);
    setRenameDraft(f.name);
  };

  const saveFolderRename = async () => {
    const f = folders.find((x) => x.id === renamingFolderId);
    const name = renameDraft.trim();
    setRenamingFolderId(null);
    if (!f || !name || name === f.name || !data) return;
    await mutate({ ...data, entries: data.entries.map((e) => (e.id === f.id ? { ...e, name } : e)) }, false);
    try {
      await patchItem(f.id, data.folderId, { name });
    } finally {
      mutate();
    }
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

  /* ---------------- multi-select ---------------- */
  const toggleSelect = (id: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    if (!data || selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selectedIds];
    await mutate({ ...data, entries: data.entries.filter((e) => !selectedIds.has(e.id)) }, false);
    try {
      await fetch("/api/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, folder: data.folderId }),
      });
    } finally {
      setBulkDeleting(false);
      exitSelectMode();
      mutate();
    }
  };

  /* ---------------- search ---------------- */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = (await fetcher(`/api/search?q=${encodeURIComponent(term)}`)) as SearchResponse;
        setSearchResults(res.results);
      } finally {
        setSearching(false);
      }
    }, 350); // debounce — don't fire a Drive query on every keystroke
    return () => clearTimeout(t);
  }, [query]);

  const searchFolders = useMemo(() => (searchResults ?? []).filter((e) => e.kind === "folder"), [searchResults]);
  const searchMedia = useMemo(() => (searchResults ?? []).filter((e) => e.kind !== "folder"), [searchResults]);

  const searchDelete = async (item: Entry) => {
    setSearchLightbox(null);
    setSearchResults((r) => r && r.filter((e) => e.id !== item.id));
    await fetch(`/api/media/${item.id}?folder=${item.parentId ?? ""}`, { method: "DELETE" });
    if (data && item.parentId === data.folderId) mutate();
  };

  const searchRename = async (item: Entry, name: string) => {
    setSearchResults((r) => r && r.map((e) => (e.id === item.id ? { ...e, name } : e)));
    await patchItem(item.id, item.parentId ?? "", { name });
    if (data && item.parentId === data.folderId) mutate();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setSearchResults(null);
  };

  const isSearchActive = query.trim().length >= 2;

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
      <div className="flex items-start gap-4 mb-4">
        {crumbs.length > 0 && !isSearchActive && (
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
            {(photoCount > 0 || videoCount > 0) && (
              <span style={{ color: "var(--faint)" }}>
                {"  ·  "}
                {[photoCount > 0 && `${photoCount} photo${photoCount === 1 ? "" : "s"}`, videoCount > 0 && `${videoCount} video${videoCount === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0 justify-end">
          <button
            className="btn btn-plain flex items-center justify-center"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label="Search"
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <button
            className="btn btn-plain flex items-center justify-center"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            aria-label="Select"
            title="Select multiple"
          >
            <CheckSquare size={16} />
          </button>
          <button className="btn btn-plain flex items-center justify-center" onClick={refresh} disabled={refreshing} aria-label="Refresh" title="Check Drive for anything added outside the app">
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>
          <button className="btn btn-plain flex items-center gap-2" onClick={() => setCreating((v) => !v)}>
            <FolderPlus size={16} /> <span className="hidden sm:inline">New folder</span>
          </button>
          <button className="btn btn-plain flex items-center justify-center" onClick={() => cameraInput.current?.click()} aria-label="Take photo">
            <Camera size={16} />
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
          <input
            ref={cameraInput}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {searchOpen && (
        <div className="card flex items-center gap-2 mb-6" style={{ padding: 12, maxWidth: 460 }}>
          <Search size={16} color="var(--faint)" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this whole library by name"
            className="flex-1 outline-none"
            style={{ fontSize: 14.5, background: "transparent" }}
          />
          {searching && <Loader2 size={14} className="spin" color="var(--faint)" />}
        </div>
      )}

      {isSearchActive ? (
        <div>
          {searching && !searchResults ? (
            <div className="flex items-center gap-2 py-16" style={{ color: "var(--faint)", fontSize: 14 }}>
              <Loader2 size={16} className="spin" /> Searching
            </div>
          ) : searchFolders.length === 0 && searchMedia.length === 0 ? (
            <p style={{ color: "var(--faint)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <>
              {searchFolders.length > 0 && (
                <div className="mb-8" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
                  {searchFolders.map((f) => (
                    <Link key={f.id} href={`/album?folder=${f.id}`} className="card" style={{ padding: 18, display: "block" }} onClick={closeSearch}>
                      <Folder size={19} color="#3e6b85" strokeWidth={1.8} />
                      <p style={{ fontSize: 15, marginTop: 14 }} className="truncate">{f.name}</p>
                      <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }} className="truncate">{f.path}</p>
                    </Link>
                  ))}
                </div>
              )}
              {searchMedia.length > 0 && (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                  {searchMedia.map((m, i) => (
                    <div key={m.id}>
                      <Thumb item={m} onOpen={() => setSearchLightbox(i)} />
                      <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }} className="truncate">{m.path}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
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

          {selectMode && (
            <div className="card flex items-center gap-3 mb-6" style={{ padding: 12 }}>
              <span style={{ fontSize: 13.5, color: "var(--dim)" }}>
                {selectedIds.size === 0 ? "Tap photos to select them" : `${selectedIds.size} selected`}
              </span>
              <div className="flex gap-2" style={{ marginLeft: "auto" }}>
                <button className="btn btn-plain" style={{ padding: "6px 12px", fontSize: 13 }} onClick={exitSelectMode}>Cancel</button>
                <button
                  className="btn flex items-center gap-1.5"
                  style={{ padding: "6px 12px", fontSize: 13, background: "var(--red)", color: "#fff" }}
                  onClick={bulkDelete}
                  disabled={selectedIds.size === 0 || bulkDeleting}
                >
                  <Trash2 size={13} /> {bulkDeleting ? "Deleting…" : `Delete${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
                </button>
              </div>
            </div>
          )}

          {folders.length > 0 && (
            <div
              className="mb-8"
              style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
            >
              {folders.map((f) =>
                renamingFolderId === f.id ? (
                  <div key={f.id} className="card flex items-center gap-1.5" style={{ padding: 12 }}>
                    <Folder size={17} color="#3e6b85" strokeWidth={1.8} className="shrink-0" />
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={saveFolderRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveFolderRename();
                        if (e.key === "Escape") setRenamingFolderId(null);
                      }}
                      className="flex-1 min-w-0 outline-none"
                      style={{ fontSize: 14, background: "transparent", borderBottom: "1px solid var(--line)" }}
                    />
                  </div>
                ) : (
                  <div key={f.id} className="group relative">
                    <Link href={`/album?folder=${f.id}`} className="card" style={{ padding: 18, display: "block" }}>
                      <Folder size={19} color="#3e6b85" strokeWidth={1.8} />
                      <p style={{ fontSize: 15, marginTop: 14 }} className="truncate pr-5">{f.name}</p>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        startFolderRename(f);
                      }}
                      aria-label="Rename folder"
                      className="absolute opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      style={{ top: 14, right: 14, width: 24, height: 24, borderRadius: 7, background: "var(--line2)", transition: "opacity .15s ease" }}
                    >
                      <Pencil size={12} color="var(--dim)" />
                    </button>
                  </div>
                ),
              )}
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
                <Thumb
                  key={m.id}
                  item={m}
                  onOpen={() => openAt(m)}
                  onDelete={() => handleDelete(m)}
                  selectMode={selectMode}
                  selected={selectedIds.has(m.id)}
                  onToggleSelect={() => toggleSelect(m.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox
          items={media}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onDelete={deleteFromLightbox}
          onRename={renameFromLightbox}
        />
      )}

      {searchLightbox !== null && searchLightbox >= 0 && (
        <Lightbox
          items={searchMedia}
          index={searchLightbox}
          onIndex={setSearchLightbox}
          onClose={() => setSearchLightbox(null)}
          onDelete={searchDelete}
          onRename={searchRename}
        />
      )}
    </div>
  );
}
