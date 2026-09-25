"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X, AlertCircle } from "lucide-react";
import { uploadOneOrFind } from "@/lib/upload";
import { folderOptions } from "@/lib/docFolders";
import { DOC_OWNERS, type DocCategory, type DocFolder, type DocOwner } from "@/lib/types";

const OWNER_LABEL: Record<DocOwner, string> = { yours: "Vamsi", hers: "Varshini", common: "Common", parents: "Parents" };
const selectStyle = { flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 } as const;

type Item = { file: File; state: "waiting" | "uploading" | "done" | "error"; pct: number; error?: string };

/**
 * Upload many files at once — e.g. a year of payslips into "TCS docs /
 * Payslips". Each file becomes its own document (named from the file name),
 * with the same folder, category and owner. Uploads run one after another
 * so a slow connection doesn't choke; a failed file doesn't stop the rest.
 */
export function UploadManyForm({ categories, folders, initialFolderId, onClose, onSaved }: {
  categories: DocCategory[];
  folders: DocFolder[];
  initialFolderId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [folderId, setFolderId] = useState<string>(initialFolderId ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [owner, setOwner] = useState<DocOwner>("common");
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const done = items.filter((i) => i.state === "done").length;
  const finished = !running && items.length > 0 && items.every((i) => i.state === "done" || i.state === "error");

  const add = (list: FileList | null) => {
    if (!list) return;
    const fresh = [...list].filter((f) => !items.some((i) => i.file.name === f.name && i.file.size === f.size));
    setItems((cur) => [...cur, ...fresh.map((file) => ({ file, state: "waiting" as const, pct: 0 }))]);
  };
  const update = (idx: number, patch: Partial<Item>) => setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const start = async () => {
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.state === "done") continue;
      update(i, { state: "uploading", pct: 0, error: undefined });
      try {
        const driveFileId = await uploadOneOrFind(it.file, null, (pct) => update(i, { pct }), "/api/docs/uploads/session", "/api/docs/uploads/find");
        const res = await fetch("/api/docs/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: it.file.name.replace(/\.[^.]+$/, "").slice(0, 140) || it.file.name,
            categoryId, owner, driveFileId,
            mimeType: it.file.type || "application/octet-stream",
            sizeBytes: it.file.size,
            tags: [],
            ...(folderId ? { folderId } : {}),
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
        update(i, { state: "done", pct: 100 });
      } catch (e) {
        update(i, { state: "error", error: e instanceof Error ? e.message : "Failed" });
      }
    }
    setRunning(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(24,20,30,.45)" }} onClick={running ? undefined : onClose}>
      <div className="card w-full sm:w-auto" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="display" style={{ fontSize: 18 }}>Upload files</p>
          {!running && <button onClick={onClose} aria-label="Close"><X size={18} color="var(--faint)" /></button>}
        </div>
        <div className="px-5 py-4" style={{ display: "grid", gap: 12 }}>
          <input ref={input} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
            disabled={running}
            className="flex flex-col items-center justify-center gap-1"
            style={{ padding: "22px 14px", borderRadius: 12, border: `1.5px dashed ${dragging ? "var(--ink)" : "var(--line)"}`, fontSize: 14, color: "var(--dim)", background: dragging ? "var(--line2)" : "transparent" }}
          >
            <Upload size={20} />
            {items.length ? "Add more files" : "Choose files, or drop them here"}
            <span style={{ fontSize: 12, color: "var(--faint)" }}>Each file becomes its own document, named from the file name</span>
          </button>

          <div className="flex gap-2 flex-wrap">
            <select aria-label="Folder" value={folderId} onChange={(e) => setFolderId(e.target.value)} style={selectStyle} disabled={running}>
              <option value="">No folder (top level)</option>
              {folderOptions(folders).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={selectStyle} disabled={running}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Belongs to" value={owner} onChange={(e) => setOwner(e.target.value as DocOwner)} style={selectStyle} disabled={running}>
              {DOC_OWNERS.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
            </select>
          </div>

          {items.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line2)", borderRadius: 10 }}>
              {items.map((it, i) => (
                <div key={`${it.file.name}-${i}`} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i ? "1px solid var(--line2)" : "none", fontSize: 13.5 }}>
                  {it.state === "done" ? <CheckCircle2 size={15} color="var(--green)" /> : it.state === "error" ? <AlertCircle size={15} color="var(--red)" /> : it.state === "uploading" ? <Loader2 size={15} className="spin" /> : <span style={{ width: 15 }} />}
                  <span className="flex-1 min-w-0 truncate">{it.file.name}</span>
                  <span style={{ fontSize: 12, color: it.state === "error" ? "var(--red)" : "var(--faint)", flexShrink: 0 }}>
                    {it.state === "uploading" ? `${it.pct}%` : it.state === "error" ? it.error : `${(it.file.size / 1024 / 1024).toFixed(1)} MB`}
                  </span>
                  {!running && it.state !== "done" && (
                    <button onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove ${it.file.name}`}><X size={13} color="var(--faint)" /></button>
                  )}
                </div>
              ))}
            </div>
          )}

          {finished ? (
            <>
              <p style={{ fontSize: 13.5 }}>{done} of {items.length} uploaded.{done < items.length ? " Failed ones can be retried." : ""}</p>
              <div className="flex gap-2">
                {done < items.length && <button className="btn btn-plain flex-1" onClick={start}>Retry failed</button>}
                <button className="btn btn-dark flex-1" onClick={onClose}>Done</button>
              </div>
            </>
          ) : (
            <button className="btn btn-dark" disabled={!items.length || !categoryId || running} onClick={start}>
              {running ? `Uploading ${done + 1} of ${items.length}…` : `Upload ${items.length || ""} file${items.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
