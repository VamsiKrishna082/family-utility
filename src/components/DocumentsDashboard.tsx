"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, ChevronRight, Search, Plus, FileText, Download, Share2, Clock, Folder, FolderPlus, Upload, Pencil, Trash2, Paperclip } from "lucide-react";
import { AddDocumentForm } from "@/components/AddDocumentForm";
import { UploadManyForm } from "@/components/UploadManyForm";
import { descendants, folderChain, folderPath } from "@/lib/docFolders";
import type { DocCategoriesResponse, DocCategory, DocExpiryLabel, DocFoldersResponse, DocOwner, DocRecord, DocRecordsResponse, DriveQuota } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

export const OWNER_LABEL: Record<DocOwner, string> = { yours: "Vamsi", hers: "Varshini", common: "Common", parents: "Parents" };
export const EXPIRY_VERB: Record<DocExpiryLabel, string> = { renew: "Renew", expires: "Expires", keep_till: "Keep till" };

export const CATEGORY_TINT: Record<string, { bg: string; fg: string }> = {
  "Identity & personal": { bg: "#E8EFEA", fg: "#2E6A4C" },
  "Insurance": { bg: "#EDEAF4", fg: "#4B3F80" },
  "Property & rent": { bg: "#F6EBD8", fg: "#8A5A0B" },
  "Vehicle": { bg: "#E9ECF3", fg: "#4A5C86" },
  "Financial & tax": { bg: "#E9EEF4", fg: "#37536F" },
  "Medical": { bg: "#F7E9E6", fg: "#8C3B28" },
  "Education & work": { bg: "#EAF1EC", fg: "#3D6B52" },
  "Warranties & bills": { bg: "#F3EFE5", fg: "#8A7A4A" },
};
const DEFAULT_TINT = { bg: "#F0ECE3", fg: "#5E5A52" };

function tintFor(categoryName: string) {
  return CATEGORY_TINT[categoryName] ?? DEFAULT_TINT;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGB(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function daysUntil(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
}

function expiryDisplay(record: DocRecord): { text: string; urgent: boolean } | null {
  if (!record.expiryDate) return null;
  const days = daysUntil(record.expiryDate);
  const dateLabel = new Date(`${record.expiryDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const verb = EXPIRY_VERB[record.expiryLabel ?? "expires"];
  const urgent = days <= 30;
  const text = days < 0 ? `${verb} — overdue since ${dateLabel}` : days <= 30 ? `${verb} in ${days} day${days === 1 ? "" : "s"} · ${dateLabel}` : `${verb} ${dateLabel}`;
  return { text, urgent };
}

export function DocumentsDashboard() {
  const { data: catData, mutate: mutateCats } = useSWR<DocCategoriesResponse>("/api/docs/categories", fetcher);
  const { data: recData, mutate: mutateRecs } = useSWR<DocRecordsResponse>("/api/docs/records", fetcher);
  const { data: quotaData } = useSWR<DriveQuota>("/api/docs/quota", fetcher);
  const { data: folderData, mutate: mutateFolders } = useSWR<DocFoldersResponse>("/api/docs/folders", fetcher);
  const { mutate: globalMutate } = useSWRConfig();

  const [ownerFilter, setOwnerFilter] = useState<DocOwner | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploadingMany, setUploadingMany] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderForm, setFolderForm] = useState<{ mode: "new" | "rename"; name: string } | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState("");

  const categories = catData?.items ?? [];
  const records = recData?.items ?? [];
  const folders = folderData?.items ?? [];
  const currentFolder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;
  const chain = folderChain(folders, folderId);
  const subFolders = folders.filter((f) => f.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name));

  /** Documents anywhere inside each folder (sub-folders included). */
  const folderCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const f of folders) {
      const inside = descendants(folders, f.id);
      out.set(f.id, records.filter((r) => r.folderId && inside.has(r.folderId)).length);
    }
    return out;
  }, [folders, records]);

  const openFolder = (id: string | null) => {
    setFolderId(id);
    setFolderForm(null);
    setFolderError("");
    setSearch("");
  };

  const saveFolder = async () => {
    if (!folderForm?.name.trim()) return;
    setFolderBusy(true);
    setFolderError("");
    try {
      const res = folderForm.mode === "new"
        ? await fetch("/api/docs/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: folderForm.name.trim(), parentId: folderId }) })
        : await fetch(`/api/docs/folders/${folderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: folderForm.name.trim() }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save the folder");
      await mutateFolders();
      setFolderForm(null);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Could not save the folder");
    } finally {
      setFolderBusy(false);
    }
  };

  const deleteFolder = async () => {
    if (!currentFolder) return;
    const where = currentFolder.parentId ? `"${folderPath(folders, currentFolder.parentId)}"` : "the top level";
    if (!window.confirm(`Remove the folder "${currentFolder.name}"? Nothing is deleted — its documents and sub-folders move up to ${where}.`)) return;
    setFolderBusy(true);
    try {
      await fetch(`/api/docs/folders/${currentFolder.id}`, { method: "DELETE" });
      await Promise.all([mutateFolders(), mutateRecs()]);
      openFolder(currentFolder.parentId);
    } finally {
      setFolderBusy(false);
    }
  };

  const createCategory = async (name: string): Promise<DocCategory | null> => {
    const res = await fetch("/api/docs/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!res.ok) return null;
    const { category } = (await res.json()) as { category: DocCategory };
    await mutateCats();
    return category;
  };

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);
    return counts;
  }, [records]);

  const expiringSoon = useMemo(
    () => records
      .filter((r) => r.expiryDate && daysUntil(r.expiryDate) <= 180)
      .sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1))
      .slice(0, 4),
    [records],
  );

  // Search, or a category picked at the top level, looks across every folder;
  // otherwise you see what sits directly in the folder you're in.
  const q = search.trim().toLowerCase();
  const spanning = Boolean(q) || (folderId === null && categoryFilter !== null);
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (!spanning && (r.folderId ?? null) !== folderId) return false;
      if (ownerFilter && r.owner !== ownerFilter) return false;
      if (categoryFilter && r.categoryId !== categoryFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.tags.some((t) => t.toLowerCase().includes(q)) && !(r.refNumberMasked ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, ownerFilter, categoryFilter, q, spanning, folderId]);

  const activeCategoryName = categoryFilter ? categories.find((c) => c.id === categoryFilter)?.name : null;

  return (
    <div>
      <div className="flex items-start gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <Link href="/" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1" style={{ minWidth: 140 }}>
          <h1 className="display" style={{ fontSize: 30 }}>Documents</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>
            {records.length} document{records.length === 1 ? "" : "s"}{quotaData?.limitBytes ? ` · ${formatGB(quotaData.usedBytes)} of ${formatGB(quotaData.limitBytes)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: "auto" }}>
          <div className="flex items-center card" style={{ padding: "0 12px", height: 44 }}>
            <Search size={15} color="var(--faint)" />
            <input
              type="search" placeholder="Search by name, number or tag" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, padding: "0 8px", width: 180 }}
            />
          </div>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setUploadingMany(true)} aria-label="Upload many files">
            <Upload size={15} /> <span className="hidden sm:inline">Upload files</span>
          </button>
          <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setAdding(true)}>
            <Plus size={15} /> <span className="hidden sm:inline">Add document</span>
          </button>
        </div>
      </div>

      {/* Owner filter */}
      <div className="flex gap-2 mb-6" style={{ flexWrap: "wrap" }}>
        <button
          onClick={() => setOwnerFilter(null)}
          style={{ height: 40, padding: "0 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: `1px solid ${ownerFilter === null ? "var(--ink)" : "var(--line)"}`, background: ownerFilter === null ? "var(--ink)" : "var(--card)", color: ownerFilter === null ? "#fff" : "var(--ink)" }}
        >
          Everyone
        </button>
        {(Object.keys(OWNER_LABEL) as DocOwner[]).map((o) => (
          <button
            key={o}
            onClick={() => setOwnerFilter(o)}
            style={{ height: 40, padding: "0 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: `1px solid ${ownerFilter === o ? "var(--ink)" : "var(--line)"}`, background: ownerFilter === o ? "var(--ink)" : "var(--card)", color: ownerFilter === o ? "#fff" : "var(--ink)" }}
          >
            {OWNER_LABEL[o]}
          </button>
        ))}
      </div>

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <div className="card mb-6" style={{ padding: 20, borderColor: "#E0C9A8" }}>
          <p className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            <Clock size={15} color="var(--amber)" /> Expiring soon
          </p>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {expiringSoon.map((r) => {
              const exp = expiryDisplay(r);
              return (
                <Link key={r.id} href={`/docs/${r.id}`} className="card" style={{ padding: "10px 12px", display: "block" }}>
                  <p className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</p>
                  <p style={{ fontSize: 12, fontWeight: exp?.urgent ? 700 : 500, color: exp?.urgent ? "var(--red)" : "var(--faint)", marginTop: 2 }}>{exp?.text}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Categories */}
        <div className="card" style={{ padding: 16, alignSelf: "start" }}>
          <p className="display" style={{ fontSize: 16, marginBottom: 10 }}>Categories</p>
          <div className="flex lg:flex-col gap-1.5" style={{ flexWrap: "wrap" }}>
            <button
              onClick={() => setCategoryFilter(null)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: 38, padding: "0 10px", borderRadius: 8, fontSize: 13.5, fontWeight: categoryFilter === null ? 700 : 500, background: categoryFilter === null ? "var(--line2)" : "transparent", textAlign: "left" }}
            >
              All documents
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: 38, padding: "0 10px", borderRadius: 8, fontSize: 13.5, fontWeight: categoryFilter === c.id ? 700 : 500, background: categoryFilter === c.id ? "var(--line2)" : "transparent", textAlign: "left" }}
              >
                <span className="truncate">{c.name}</span>
                <span style={{ fontSize: 12, color: "var(--faint)", flexShrink: 0 }}>{categoryCounts.get(c.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Documents grid */}
        <div>
          {/* Folders: breadcrumbs, actions, sub-folders */}
          <div className="flex items-center gap-1 mb-3" style={{ flexWrap: "wrap", fontSize: 13.5 }}>
            <button onClick={() => openFolder(null)} style={{ fontWeight: folderId === null ? 700 : 500, color: folderId === null ? "var(--ink)" : "var(--dim)", padding: "6px 4px" }}>
              All folders
            </button>
            {chain.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight size={14} color="var(--faint)" />
                <button onClick={() => openFolder(f.id)} style={{ fontWeight: f.id === folderId ? 700 : 500, color: f.id === folderId ? "var(--ink)" : "var(--dim)", padding: "6px 4px" }}>
                  {f.name}
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1" style={{ marginLeft: "auto" }}>
              <button className="btn btn-plain flex items-center gap-1" style={{ fontSize: 12.5, padding: "6px 10px" }} onClick={() => { setFolderError(""); setFolderForm({ mode: "new", name: "" }); }}>
                <FolderPlus size={14} /> {folderId ? "New sub-folder" : "New folder"}
              </button>
              {currentFolder && (
                <>
                  <button className="btn btn-plain flex items-center" style={{ padding: "6px 9px" }} aria-label="Rename folder" onClick={() => { setFolderError(""); setFolderForm({ mode: "rename", name: currentFolder.name }); }}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-plain flex items-center" style={{ padding: "6px 9px", color: "var(--red)" }} aria-label="Remove folder" onClick={deleteFolder} disabled={folderBusy}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {folderForm && (
            <div className="card flex items-center gap-2 mb-3" style={{ padding: 10 }}>
              <Folder size={16} color="var(--faint)" />
              <input
                autoFocus type="text" value={folderForm.name} maxLength={80}
                placeholder={folderForm.mode === "new" ? (currentFolder ? `Sub-folder inside ${currentFolder.name}, e.g. Payslips` : "Folder name, e.g. TCS docs") : "Folder name"}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveFolder(); if (e.key === "Escape") setFolderForm(null); }}
                className="flex-1" style={{ border: "none", outline: "none", fontSize: 14, background: "transparent", minWidth: 0 }}
              />
              <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setFolderForm(null)}>Cancel</button>
              <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={saveFolder} disabled={!folderForm.name.trim() || folderBusy}>
                {folderBusy ? "Saving…" : folderForm.mode === "new" ? "Create" : "Rename"}
              </button>
            </div>
          )}
          {folderError && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{folderError}</p>}

          {!spanning && subFolders.length > 0 && (
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", marginBottom: 18 }}>
              {subFolders.map((f) => {
                const subCount = folders.filter((x) => x.parentId === f.id).length;
                const docCount = folderCounts.get(f.id) ?? 0;
                return (
                  <button key={f.id} onClick={() => openFolder(f.id)} className="card flex items-center gap-3" style={{ padding: "12px 14px", textAlign: "left" }}>
                    <Folder size={22} color="#8A5A0B" fill="#F6EBD8" strokeWidth={1.6} style={{ flexShrink: 0 }} />
                    <span className="min-w-0">
                      <span className="truncate" style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{f.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>
                        {docCount} document{docCount === 1 ? "" : "s"}{subCount ? ` · ${subCount} folder${subCount === 1 ? "" : "s"}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-baseline justify-between mb-3">
            <p className="display" style={{ fontSize: 20 }}>
              {q ? "Search results" : activeCategoryName ?? currentFolder?.name ?? "All documents"}{ownerFilter ? ` · ${OWNER_LABEL[ownerFilter]}` : ""}
            </p>
            <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{filtered.length} shown{spanning && folders.length ? " · all folders" : ""}</p>
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--faint)", fontSize: 14 }}>
              {records.length === 0
                ? "No documents yet — add your first one."
                : !spanning && currentFolder
                  ? subFolders.length ? "No documents directly in this folder — open a sub-folder above, or add some here." : "This folder is empty — use Upload files or Add document to fill it."
                  : !spanning && !ownerFilter && !categoryFilter && folders.length ? "Everything is inside folders — open one above." : "Nothing matches these filters."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
              {filtered.map((r) => {
                const category = categories.find((c) => c.id === r.categoryId);
                const tint = tintFor(category?.name ?? "");
                const exp = expiryDisplay(r);
                return (
                  <div key={r.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ position: "relative", height: 100, background: tint.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={28} color={tint.fg} strokeWidth={1.6} />
                      <span style={{ position: "absolute", right: 10, bottom: 10, padding: "4px 9px", borderRadius: 999, background: "#fff", fontSize: 10.5, fontWeight: 700, color: "var(--dim)" }}>
                        {OWNER_LABEL[r.owner]}
                      </span>
                    </div>
                    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <p className="truncate" style={{ fontSize: 14.5, fontWeight: 700 }}>{r.name}</p>
                      <p className="flex items-center gap-1" style={{ fontSize: 11.5, color: "var(--faint)" }}>
                        {r.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"} · {formatBytes(r.sizeBytes)}
                        {(r.attachments?.length ?? 0) > 0 && <><span>·</span><Paperclip size={11} /> +{r.attachments!.length} file{r.attachments!.length === 1 ? "" : "s"}</>}
                      </p>
                      {spanning && r.folderId && (
                        <button onClick={() => openFolder(r.folderId!)} className="flex items-center gap-1 truncate" style={{ fontSize: 11.5, color: "var(--dim)", textAlign: "left" }}>
                          <Folder size={11} style={{ flexShrink: 0 }} /> <span className="truncate">{folderPath(folders, r.folderId)}</span>
                        </button>
                      )}
                      {exp && <p style={{ fontSize: 11.5, fontWeight: exp.urgent ? 700 : 500, color: exp.urgent ? "var(--red)" : "var(--faint)" }}>{exp.text}</p>}
                      <div className="flex gap-1.5" style={{ marginTop: "auto", paddingTop: 6 }}>
                        <Link href={`/docs/${r.id}`} className="btn btn-plain flex-1 flex items-center justify-center" style={{ height: 44, fontSize: 12.5 }}>
                          View
                        </Link>
                        <a href={`/api/docs/file/${r.currentDriveFileId}`} target="_blank" rel="noreferrer" aria-label="Download" className="btn btn-plain flex items-center justify-center" style={{ width: 44, height: 44 }}>
                          <Download size={22} />
                        </a>
                        <Link href={`/docs/${r.id}?share=1`} aria-label="Share securely" className="btn btn-plain flex items-center justify-center" style={{ width: 44, height: 44 }}>
                          <Share2 size={22} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <AddDocumentForm
          categories={categories}
          folders={folders}
          initialFolderId={folderId}
          onClose={() => setAdding(false)}
          onSaved={() => { mutateRecs(); globalMutate("/api/docs/quota"); }}
          onCreateCategory={createCategory}
        />
      )}
      {uploadingMany && (
        <UploadManyForm
          categories={categories}
          folders={folders}
          initialFolderId={folderId}
          onClose={() => setUploadingMany(false)}
          onSaved={() => { mutateRecs(); globalMutate("/api/docs/quota"); }}
        />
      )}
    </div>
  );
}
