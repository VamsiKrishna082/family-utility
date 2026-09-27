"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import type { DocFolderShare } from "@/lib/types";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const EXPIRY = [{ days: 1, label: "24 hours" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }] as const;

/**
 * Share a whole folder (and its sub-folders) with a time-limited, read-only
 * link — e.g. "Loan application" documents for a bank. Anyone with the link
 * can open the files until it expires or is revoked.
 */
export function FolderShareSheet({ folderId, folderName, onClose }: { folderId: string; folderName: string; onClose: () => void }) {
  const { data, mutate } = useSWR<{ items: DocFolderShare[] }>(`/api/docs/folders/${folderId}/share`, fetcher);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const active = (data?.items ?? []).filter((s) => !s.revoked && s.expiresAt > Date.now());
  const url = (t: string) => `${origin}/share/folder/${t}`;

  const create = async (days: 1 | 7 | 30) => {
    setBusy(true);
    try {
      await fetch(`/api/docs/folders/${folderId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
      await mutate();
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (t: string) => { await fetch(`/api/docs/folders/${folderId}/share/${t}`, { method: "PATCH" }); await mutate(); };
  const copy = async (t: string) => { await navigator.clipboard.writeText(url(t)); setCopied(t); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(24,20,30,.45)" }} onClick={onClose}>
      <div className="card w-full sm:w-auto" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Share ${folderName}`}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="display" style={{ fontSize: 18 }}>Share “{folderName}”</p>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--faint)" /></button>
        </div>
        <div className="px-5 py-4" style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 13.5, color: "var(--dim)" }}>
            Anyone with the link can view and download every document in this folder and its sub-folders — no sign-in — until it expires or you revoke it. Other folders stay private.
          </p>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {EXPIRY.map((e) => (
              <button key={e.days} className="btn btn-plain" style={{ fontSize: 13 }} disabled={busy} onClick={() => create(e.days)}>+ Link for {e.label}</button>
            ))}
          </div>
          {active.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--faint)" }}>No active links.</p>
          ) : (
            active.map((s) => (
              <div key={s.token} className="card" style={{ padding: 12 }}>
                <input readOnly value={url(s.token)} onFocus={(e) => e.target.select()} aria-label="Folder link" style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--dim)" }} />
                <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--faint)", marginRight: "auto" }}>
                    Expires {new Date(s.expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <button onClick={() => copy(s.token)} className="flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: copied === s.token ? "var(--green)" : "var(--indigo)" }}>
                    {copied === s.token ? <Check size={13} /> : <Copy size={13} />} {copied === s.token ? "Copied" : "Copy"}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${folderName}: ${url(s.token)}`)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--indigo)" }}>WhatsApp</a>
                  <a href={url(s.token)} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--indigo)" }}><ExternalLink size={13} /> Open</a>
                  <button onClick={() => revoke(s.token)} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red)" }}>Revoke</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
