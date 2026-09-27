"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, FileText } from "lucide-react";
import { PrintButton } from "@/components/trips/PrintButton";

type Resp = {
  fy: number; label: string; from: string; to: string; currentFy: number;
  incomeByCategory: { name: string; paise: number }[]; incomeTotalPaise: number;
  buckets: { bucket: string; label: string; totalPaise: number; count: number }[];
  checklist: { key: string; label: string; hint: string; docs: { id: string; name: string }[] }[];
  error?: string;
};
const fetcher = (u: string) => fetch(u).then((r) => r.json());
const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const nice = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Tax-season pack: one page per financial year with what you'll need at ITR
 * time — income, rent, health insurance, 80C investments, home loan,
 * donations — and a checklist of documents, found or still missing.
 * Printable. It gathers what's in the app; it isn't tax advice.
 */
export function TaxPack() {
  const [fy, setFy] = useState<number | null>(null);
  const { data } = useSWR<Resp>(`/api/money/tax${fy ? `?fy=${fy}` : ""}`, fetcher);
  const found = data?.checklist.filter((c) => c.docs.length).length ?? 0;

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } .card { break-inside: avoid; } }`}</style>
      <div className="flex items-center gap-4 mb-5" style={{ flexWrap: "wrap" }}>
        <Link href="/money" className="flex items-center justify-center card no-print" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="Money"><ChevronLeft size={19} /></Link>
        <div className="flex-1" style={{ minWidth: 180 }}>
          <h1 className="display" style={{ fontSize: 30 }}>Tax pack</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 2 }}>{data ? `${data.label} · ${nice(data.from)} – ${nice(data.to)}` : "Loading…"}</p>
        </div>
        {data && (
          <div className="flex items-center gap-2 no-print">
            <div className="flex items-center gap-1 card" style={{ padding: "6px 10px" }}>
              <button aria-label="Previous year" onClick={() => setFy(data.fy - 1)}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 92, textAlign: "center" }}>{data.label}</span>
              <button aria-label="Next year" disabled={data.fy >= data.currentFy} onClick={() => setFy(data.fy + 1)} style={{ opacity: data.fy >= data.currentFy ? 0.3 : 1 }}><ChevronRight size={16} /></button>
            </div>
            <PrintButton />
          </div>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <section className="card" style={{ padding: 18 }}>
            <p className="display" style={{ fontSize: 18, marginBottom: 6 }}>From Money</p>
            <Row label="Income" value={rupees(data.incomeTotalPaise)} strong />
            {data.incomeByCategory.map((c) => <Row key={c.name} label={`· ${c.name}`} value={rupees(c.paise)} dim />)}
            <div style={{ height: 8 }} />
            {data.buckets.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)", padding: "6px 0" }}>No rent, insurance, investments or other tax-relevant entries in this year yet.</p>}
            {data.buckets.map((b) => <Row key={b.bucket} label={b.label} value={`${rupees(b.totalPaise)} · ${b.count} entr${b.count === 1 ? "y" : "ies"}`} />)}
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 10 }}>
              Worked out from each entry’s category, sub-category and note. Totals are what you logged — check them against statements, and ask your CA what can be claimed.
            </p>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="display" style={{ fontSize: 18 }}>Documents checklist</p>
              <span style={{ fontSize: 12.5, color: "var(--faint)" }}>{found} of {data.checklist.length} found</span>
            </div>
            {data.checklist.map((c) => (
              <div key={c.key} className="flex items-start gap-3" style={{ padding: "9px 0", borderTop: "1px solid var(--line2)" }}>
                {c.docs.length ? <CheckCircle2 size={17} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={17} color="var(--faint)" style={{ flexShrink: 0, marginTop: 1 }} />}
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
                  {c.docs.length ? (
                    c.docs.slice(0, 4).map((d) => (
                      <Link key={d.id} href={`/docs/${d.id}`} className="flex items-center gap-1.5 truncate" style={{ fontSize: 12.5, color: "var(--indigo)" }}><FileText size={12} /> {d.name}</Link>
                    ))
                  ) : (
                    <span className="block" style={{ fontSize: 12.5, color: "var(--faint)" }}>{c.hint} — add it in Documents</span>
                  )}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 10 }}>Matched by document name, tags, folder and category — e.g. name a file “Form 16 FY26-27” or tag it “80c”.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, dim }: { label: string; value: string; strong?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: "6px 0", borderTop: dim ? "none" : "1px solid var(--line2)", fontSize: dim ? 13 : 14 }}>
      <span style={{ color: dim ? "var(--faint)" : "var(--ink)" }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}
