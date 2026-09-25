"use client";

import { useRef, useState } from "react";
import { X, Plus, Upload, Paperclip } from "lucide-react";
import { uploadOneOrFind } from "@/lib/upload";
import { parseRupeesToPaise } from "@/lib/money";
import { folderOptions } from "@/lib/docFolders";
import { DOC_EXPIRY_LABELS, DOC_OWNERS, type DocCategory, type DocExpiryLabel, type DocFolder, type DocOwner } from "@/lib/types";

const OWNER_LABEL: Record<DocOwner, string> = { yours: "Vamsi", hers: "Varshini", common: "Common", parents: "Parents" };
const EXPIRY_VERB: Record<DocExpiryLabel, string> = { renew: "Renew on", expires: "Expires on", keep_till: "Keep till" };

export function AddDocumentForm({
  categories,
  folders,
  initialFolderId,
  onClose,
  onSaved,
  onCreateCategory,
}: {
  categories: DocCategory[];
  folders: DocFolder[];
  initialFolderId: string | null;
  onClose: () => void;
  onSaved: () => void;
  onCreateCategory: (name: string) => Promise<DocCategory | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // First file is the document itself; any more are kept with it as extra files.
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0] ?? null;
  const [folderId, setFolderId] = useState(initialFolderId ?? "");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [owner, setOwner] = useState<DocOwner>("common");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryLabel, setExpiryLabel] = useState<DocExpiryLabel>("expires");
  const [issuer, setIssuer] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [coverAmount, setCoverAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files, ...[...list].filter((f) => !files.some((x) => x.name === f.name && x.size === f.size))];
    setFiles(next);
    if (next[0] && !name) setName(next[0].name.replace(/\.[^.]+$/, ""));
  };

  const createCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCreatingCategory(true);
    try {
      const category = await onCreateCategory(trimmed);
      if (category) {
        setCategoryId(category.id);
        setNewCategoryName("");
        setAddingCategory(false);
      }
    } finally {
      setCreatingCategory(false);
    }
  };

  const canSave = Boolean(file && name.trim() && categoryId && !saving);

  const save = async () => {
    if (!file || !name.trim() || !categoryId) return;
    setSaving(true);
    setError("");
    try {
      // Progress across all files, weighted by size.
      const total = files.reduce((s, f) => s + f.size, 0) || 1;
      let doneBytes = 0;
      const uploaded: { driveFileId: string; f: File }[] = [];
      setUploadPct(0);
      for (const f of files) {
        const id = await uploadOneOrFind(f, null, (pct) => setUploadPct(Math.round(((doneBytes + (f.size * pct) / 100) / total) * 100)), "/api/docs/uploads/session", "/api/docs/uploads/find");
        doneBytes += f.size;
        uploaded.push({ driveFileId: id, f });
      }
      const driveFileId = uploaded[0].driveFileId;

      const coverAmountPaise = coverAmount.trim() ? parseRupeesToPaise(coverAmount) : undefined;
      const res = await fetch("/api/docs/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          categoryId,
          owner,
          driveFileId,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          expiryDate: hasExpiry && expiryDate ? expiryDate : undefined,
          expiryLabel: hasExpiry && expiryDate ? expiryLabel : undefined,
          issuer: issuer.trim() || undefined,
          refNumberMasked: refNumber.trim() || undefined,
          coverAmountPaise: coverAmountPaise ?? undefined,
          notes: notes.trim() || undefined,
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
          ...(folderId ? { folderId } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
      if (uploaded.length > 1) {
        const { record: { id } } = (await res.json()) as { record: { id: string } };
        const more = await fetch(`/api/docs/records/${id}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: uploaded.slice(1).map(({ driveFileId: d, f }) => ({ driveFileId: d, name: f.name, mimeType: f.type || "application/octet-stream", sizeBytes: f.size })) }),
        });
        if (!more.ok) throw new Error("Saved the document, but the extra files didn't attach — add them from the document page");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
      setUploadPct(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(24,20,30,.45)" }} onClick={onClose}>
      <div
        className="card w-full sm:w-auto"
        style={{ maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="display" style={{ fontSize: 18 }}>Add document</p>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--faint)" /></button>
        </div>

        <div className="px-5 py-4" style={{ display: "grid", gap: 12 }}>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
          />
          {files.length > 0 && (
            <div style={{ border: "1px solid var(--line2)", borderRadius: 10 }}>
              {files.map((f, i) => (
                <div key={`${f.name}-${f.size}`} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i ? "1px solid var(--line2)" : "none", fontSize: 13.5 }}>
                  {i === 0 ? <Upload size={14} color="var(--faint)" /> : <Paperclip size={14} color="var(--faint)" />}
                  <span className="flex-1 min-w-0 truncate">{f.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--faint)", flexShrink: 0 }}>{i === 0 ? "main file" : "extra file"}</span>
                  {!saving && <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X size={13} color="var(--faint)" /></button>}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2"
            style={{ padding: "12px 14px", borderRadius: 10, border: `1px dashed var(--line)`, fontSize: 14, color: "var(--faint)", textAlign: "left" }}
            disabled={saving}
          >
            <Upload size={16} />
            {files.length ? "Add more files to this document" : "Choose file(s) — pick several to keep them together"}
          </button>

          <input
            type="text" placeholder="Document name" value={name} onChange={(e) => setName(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          />

          <select
            aria-label="Folder" value={folderId} onChange={(e) => setFolderId(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          >
            <option value="">No folder (top level)</option>
            {folderOptions(folders).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>

          <div className="flex gap-2 flex-wrap">
            <select
              value={categoryId ?? ""}
              onChange={(e) => (e.target.value === "__new" ? setAddingCategory(true) : setCategoryId(e.target.value))}
              style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">+ New category…</option>
            </select>
            <select
              value={owner} onChange={(e) => setOwner(e.target.value as DocOwner)}
              style={{ flex: 1, minWidth: 120, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
            >
              {DOC_OWNERS.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
            </select>
          </div>

          {addingCategory && (
            <div className="card flex gap-2" style={{ padding: 10 }}>
              <input
                autoFocus type="text" placeholder="New category name" value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
                className="flex-1" style={{ border: "none", outline: "none", fontSize: 13.5, background: "transparent" }}
              />
              <button className="btn btn-plain" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => setAddingCategory(false)}>Cancel</button>
              <button className="btn btn-dark" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={createCategory} disabled={!newCategoryName.trim() || creatingCategory}>
                {creatingCategory ? "Adding…" : "Add"}
              </button>
            </div>
          )}

          <label className="flex items-center gap-2" style={{ fontSize: 13.5, color: "var(--dim)" }}>
            <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
            This document has an expiry or renewal date
          </label>

          {hasExpiry && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={expiryLabel} onChange={(e) => setExpiryLabel(e.target.value as DocExpiryLabel)}
                style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
              >
                {DOC_EXPIRY_LABELS.map((l) => <option key={l} value={l}>{EXPIRY_VERB[l]}</option>)}
              </select>
              <input
                type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <input
              type="text" placeholder="Issuer (optional)" value={issuer} onChange={(e) => setIssuer(e.target.value)}
              style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
            />
            <input
              type="text" placeholder="Reference / policy no. (optional)" value={refNumber} onChange={(e) => setRefNumber(e.target.value)}
              style={{ flex: 1, minWidth: 140, borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
            />
          </div>
          <input
            type="number" inputMode="decimal" placeholder="Cover / sum insured, ₹ (optional)" value={coverAmount} onChange={(e) => setCoverAmount(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          />
          <input
            type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          />
          <input
            type="text" placeholder="Tags, comma separated (optional)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          />

          {uploadPct !== null && (
            <div>
              <div style={{ height: 4, background: "var(--line2)", borderRadius: 4 }}>
                <div style={{ height: 4, width: `${uploadPct}%`, background: "var(--indigo)", borderRadius: 4, transition: "width .2s ease" }} />
              </div>
              <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>Uploading… {uploadPct}%</p>
            </div>
          )}

          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

          <button className="btn btn-dark flex items-center justify-center gap-1.5" onClick={save} disabled={!canSave}>
            <Plus size={15} /> {saving ? "Saving…" : "Save document"}
          </button>
        </div>
      </div>
    </div>
  );
}
