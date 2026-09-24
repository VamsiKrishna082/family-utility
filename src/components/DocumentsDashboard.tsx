"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ChevronLeft, Search, Plus, FileText, Download, Share2, Clock } from "lucide-react";
import { AddDocumentForm } from "@/components/AddDocumentForm";
import type { DocCategoriesResponse, DocCategory, DocExpiryLabel, DocOwner, DocRecord, DocRecordsResponse, DriveQuota } from "@/lib/types";

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
  const { mutate: globalMutate } = useSWRConfig();

  const [ownerFilter, setOwnerFilter] = useState<DocOwner | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const categories = catData?.items ?? [];
  const records = recData?.items ?? [];

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (ownerFilter && r.owner !== ownerFilter) return false;
      if (categoryFilter && r.categoryId !== categoryFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.tags.some((t) => t.toLowerCase().includes(q)) && !(r.refNumberMasked ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, ownerFilter, categoryFilter, search]);

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
          <div className="flex items-baseline justify-between mb-3">
            <p className="display" style={{ fontSize: 20 }}>{activeCategoryName ?? "All documents"}{ownerFilter ? ` · ${OWNER_LABEL[ownerFilter]}` : ""}</p>
            <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{filtered.length} shown</p>
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--faint)", fontSize: 14 }}>
              {records.length === 0 ? "No documents yet — add your first one." : "Nothing matches these filters."}
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
                      <p style={{ fontSize: 11.5, color: "var(--faint)" }}>{r.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"} · {formatBytes(r.sizeBytes)}</p>
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
          onClose={() => setAdding(false)}
          onSaved={() => { mutateRecs(); globalMutate("/api/docs/quota"); }}
          onCreateCategory={createCategory}
        />
      )}
    </div>
  );
}
