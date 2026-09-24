"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, Download, Share2, Upload, Pencil, Trash2, Copy, X } from "lucide-react";
import { uploadOneOrFind } from "@/lib/upload";
import { formatPaiseExact, parseRupeesToPaise } from "@/lib/money";
import { OWNER_LABEL, EXPIRY_VERB } from "@/components/DocumentsDashboard";
import { DOC_EXPIRY_LABELS, DOC_OWNERS, type DocCategoriesResponse, type DocExpiryLabel, type DocOwner, type DocRecordResponse, type DocSharesResponse } from "@/lib/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EXPIRY_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: "24 hours" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" },
];

export function DocumentDetail({ id, openShareOnLoad }: { id: string; openShareOnLoad: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<DocRecordResponse>(`/api/docs/records/${id}`, fetcher);
  const { data: catData } = useSWR<DocCategoriesResponse>("/api/docs/categories", fetcher);
  const { data: sharesData, mutate: mutateShares } = useSWR<DocSharesResponse>(`/api/docs/records/${id}/share`, fetcher);
  const replaceInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(openShareOnLoad);
  const [replacing, setReplacing] = useState(false);
  const [replacePct, setReplacePct] = useState<number | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftOwner, setDraftOwner] = useState<DocOwner>("common");
  const [draftExpiry, setDraftExpiry] = useState("");
  const [draftExpiryLabel, setDraftExpiryLabel] = useState<DocExpiryLabel>("expires");
  const [draftIssuer, setDraftIssuer] = useState("");
  const [draftRef, setDraftRef] = useState("");
  const [draftCover, setDraftCover] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [saving, setSaving] = useState(false);

  if (error) return <div className="card" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>;
  if (isLoading && !data) return <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>;
  if (!data) return null;

  const { record } = data;
  const categories = catData?.items ?? [];
  const category = categories.find((c) => c.id === record.categoryId);
  const isPdf = record.mimeType === "application/pdf";
  const isImage = record.mimeType.startsWith("image/");
  const fileUrl = `/api/docs/file/${record.currentDriveFileId}`;

  const startEdit = () => {
    setDraftCategoryId(record.categoryId);
    setDraftOwner(record.owner);
    setDraftExpiry(record.expiryDate ?? "");
    setDraftExpiryLabel(record.expiryLabel ?? "expires");
    setDraftIssuer(record.issuer ?? "");
    setDraftRef(record.refNumberMasked ?? "");
    setDraftCover(record.coverAmountPaise ? String(record.coverAmountPaise / 100) : "");
    setDraftNotes(record.notes ?? "");
    setDraftTags(record.tags.join(", "));
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const coverAmountPaise = draftCover.trim() ? parseRupeesToPaise(draftCover) : null;
      await fetch(`/api/docs/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: draftCategoryId,
          owner: draftOwner,
          expiryDate: draftExpiry || null,
          expiryLabel: draftExpiry ? draftExpiryLabel : null,
          issuer: draftIssuer.trim() || null,
          refNumberMasked: draftRef.trim() || null,
          coverAmountPaise: coverAmountPaise ?? null,
          notes: draftNotes.trim() || null,
          tags: draftTags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      await mutate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async () => {
    if (!window.confirm(`Delete "${record.name}" permanently? This can't be undone.`)) return;
    await fetch(`/api/docs/records/${id}`, { method: "DELETE" });
    window.location.href = "/docs";
  };

  const replaceVersion = async (file: File) => {
    setReplacing(true);
    setReplacePct(0);
    try {
      const driveFileId = await uploadOneOrFind(file, null, (pct) => setReplacePct(pct), "/api/docs/uploads/session", "/api/docs/uploads/find");
      await fetch(`/api/docs/records/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveFileId, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      await mutate();
    } finally {
      setReplacing(false);
      setReplacePct(null);
    }
  };

  const createShare = async (days: number) => {
    setCreatingShare(true);
    try {
      await fetch(`/api/docs/records/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresInDays: days }) });
      await mutateShares();
    } finally {
      setCreatingShare(false);
    }
  };

  const revokeShare = async (token: string) => {
    await fetch(`/api/docs/records/${id}/share/${token}`, { method: "PATCH" });
    await mutateShares();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const activeShares = (sharesData?.items ?? []).filter((s) => !s.revoked && s.expiresAt > Date.now());

  return (
    <div>
      <div className="flex items-start gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <Link href="/docs" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }}>
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1" style={{ minWidth: 160 }}>
          <h1 className="display" style={{ fontSize: 26 }}>{record.name}</h1>
          <p style={{ color: "var(--dim)", fontSize: 13.5, marginTop: 4 }}>
            {category?.name ?? "Uncategorised"} · {OWNER_LABEL[record.owner]} · updated {new Date(record.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 shrink-0" style={{ marginLeft: "auto" }}>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-plain flex items-center gap-1.5" style={{ minHeight: 44 }}>
            <Download size={22} /> <span className="hidden sm:inline">Download</span>
          </a>
          <button className="btn btn-plain flex items-center gap-1.5" style={{ minHeight: 44 }} onClick={() => setShareOpen((v) => !v)}>
            <Share2 size={22} /> <span className="hidden sm:inline">Share</span>
          </button>
          <input ref={replaceInput} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceVersion(f); e.target.value = ""; }} />
          <button className="btn btn-dark flex items-center gap-1.5" style={{ minHeight: 44 }} onClick={() => replaceInput.current?.click()} disabled={replacing}>
            <Upload size={22} /> <span className="hidden sm:inline">{replacing ? `Uploading ${replacePct ?? 0}%` : "Replace with new version"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="card" style={{ overflow: "hidden", minHeight: 400 }}>
          {isPdf ? (
            <iframe src={fileUrl} title={record.name} style={{ width: "100%", height: "75vh", border: "none", display: "block" }} />
          ) : isImage ? (
            <img src={fileUrl} alt={record.name} style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--faint)", fontSize: 14 }}>
              This file type can&apos;t be previewed — use Download instead.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Details */}
          <div className="card" style={{ padding: 20 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="display" style={{ fontSize: 18 }}>Details</p>
              {!editing && (
                <button onClick={startEdit} className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--faint)" }}>
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>

            {editing ? (
              <div style={{ display: "grid", gap: 10 }}>
                <select value={draftCategoryId} onChange={(e) => setDraftCategoryId(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={draftOwner} onChange={(e) => setDraftOwner(e.target.value as DocOwner)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
                  {DOC_OWNERS.map((o) => <option key={o} value={o}>{OWNER_LABEL[o]}</option>)}
                </select>
                <div className="flex gap-2">
                  <select value={draftExpiryLabel} onChange={(e) => setDraftExpiryLabel(e.target.value as DocExpiryLabel)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }}>
                    {DOC_EXPIRY_LABELS.map((l) => <option key={l} value={l}>{EXPIRY_VERB[l]}</option>)}
                  </select>
                  <input type="date" value={draftExpiry} onChange={(e) => setDraftExpiry(e.target.value)} style={{ flex: 1, borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                </div>
                <input type="text" placeholder="Issuer" value={draftIssuer} onChange={(e) => setDraftIssuer(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                <input type="text" placeholder="Reference / policy no." value={draftRef} onChange={(e) => setDraftRef(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                <input type="number" inputMode="decimal" placeholder="Cover amount, ₹" value={draftCover} onChange={(e) => setDraftCover(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                <input type="text" placeholder="Notes" value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                <input type="text" placeholder="Tags, comma separated" value={draftTags} onChange={(e) => setDraftTags(e.target.value)} style={{ borderRadius: 8, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13.5 }} />
                <div className="flex gap-2">
                  <button className="btn btn-dark" style={{ fontSize: 13, padding: "6px 14px" }} onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  <button onClick={() => setEditing(false)} style={{ fontSize: 13, color: "var(--faint)" }}>Cancel</button>
                  <button onClick={deleteDocument} className="flex items-center gap-1" style={{ fontSize: 12.5, color: "var(--red)", marginLeft: "auto" }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <Row label="Category" value={category?.name ?? "—"} />
                <Row label="Belongs to" value={OWNER_LABEL[record.owner]} />
                {record.issuer && <Row label="Issuer" value={record.issuer} />}
                {record.refNumberMasked && <Row label="Reference" value={record.refNumberMasked} strong />}
                {record.coverAmountPaise !== undefined && <Row label="Cover" value={formatPaiseExact(record.coverAmountPaise)} />}
                {record.expiryDate && (
                  <Row label={EXPIRY_VERB[record.expiryLabel ?? "expires"]} value={new Date(`${record.expiryDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} strong />
                )}
                {record.notes && <Row label="Notes" value={record.notes} />}
                <Row label="File" value={`${formatBytes(record.sizeBytes)} · ${record.mimeType}`} />
                {record.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap" style={{ paddingTop: 4 }}>
                    {record.tags.map((t) => (
                      <span key={t} style={{ padding: "4px 10px", borderRadius: 999, background: "var(--line2)", fontSize: 11.5, fontWeight: 600, color: "var(--dim)" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Versions */}
          {record.versions.length > 1 && (
            <div className="card" style={{ padding: 20 }}>
              <p className="display" style={{ fontSize: 18, marginBottom: 10 }}>Versions</p>
              {record.versions.map((v, i) => (
                <div key={v.driveFileId + v.addedAt} className="flex items-center justify-between" style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line2)" }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600 }}>{i === 0 ? "Current" : "Superseded"}</p>
                    <p style={{ fontSize: 11.5, color: "var(--faint)" }}>added {new Date(v.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <a href={`/api/docs/file/${v.driveFileId}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--indigo)" }}>Open</a>
                </div>
              ))}
            </div>
          )}

          {/* Share */}
          {shareOpen && (
            <div className="card" style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="display" style={{ fontSize: 18 }}>Share securely</p>
                <button onClick={() => setShareOpen(false)} aria-label="Close"><X size={16} color="var(--faint)" /></button>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--faint)", marginBottom: 12 }}>
                Anyone with the link can view this document without signing in, until it expires or you revoke it.
              </p>
              <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
                {EXPIRY_OPTIONS.map((o) => (
                  <button key={o.days} className="btn btn-plain" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => createShare(o.days)} disabled={creatingShare}>
                    + {o.label}
                  </button>
                ))}
              </div>
              {activeShares.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--faint)" }}>No active links.</p>
              ) : (
                activeShares.map((s) => (
                  <div key={s.token} className="flex items-center justify-between gap-2" style={{ padding: "8px 0", borderTop: "1px solid var(--line2)" }}>
                    <div className="min-w-0">
                      <p style={{ fontSize: 12.5, fontWeight: 600 }}>Expires {new Date(s.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copyLink(s.token)} aria-label="Copy link" style={{ padding: 6, color: copiedToken === s.token ? "var(--green)" : "var(--faint)" }}>
                        <Copy size={14} />
                      </button>
                      <button onClick={() => revokeShare(s.token)} style={{ fontSize: 12, color: "var(--red)", padding: "4px 8px" }}>Revoke</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4" style={{ fontSize: 13.5 }}>
      <span style={{ color: "var(--faint)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}
