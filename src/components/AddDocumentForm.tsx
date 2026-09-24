"use client";

import { useRef, useState } from "react";
import { X, Plus, Upload } from "lucide-react";
import { uploadOneOrFind } from "@/lib/upload";
import { parseRupeesToPaise } from "@/lib/money";
import { DOC_EXPIRY_LABELS, DOC_OWNERS, type DocCategory, type DocExpiryLabel, type DocOwner } from "@/lib/types";

const OWNER_LABEL: Record<DocOwner, string> = { yours: "Vamsi", hers: "Varshini", common: "Common", parents: "Parents" };
const EXPIRY_VERB: Record<DocExpiryLabel, string> = { renew: "Renew on", expires: "Expires on", keep_till: "Keep till" };

export function AddDocumentForm({
  categories,
  onClose,
  onSaved,
  onCreateCategory,
}: {
  categories: DocCategory[];
  onClose: () => void;
  onSaved: () => void;
  onCreateCategory: (name: string) => Promise<DocCategory | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
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

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
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
      setUploadPct(0);
      const driveFileId = await uploadOneOrFind(file, null, (pct) => setUploadPct(pct), "/api/docs/uploads/session", "/api/docs/uploads/find");

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
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not save");
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
            hidden
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2"
            style={{ padding: "12px 14px", borderRadius: 10, border: `1px dashed var(--line)`, fontSize: 14, color: file ? "var(--ink)" : "var(--faint)", textAlign: "left" }}
          >
            <Upload size={16} />
            {file ? file.name : "Choose a file to upload"}
          </button>

          <input
            type="text" placeholder="Document name" value={name} onChange={(e) => setName(e.target.value)}
            style={{ borderRadius: 10, border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14 }}
          />

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
