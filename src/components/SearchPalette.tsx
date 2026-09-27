"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, FileText, Image as ImageIcon, Loader2, Plane, Search, Wallet, X } from "lucide-react";

type Hit = { section: "documents" | "trips" | "money" | "dates" | "album"; id: string; title: string; sub: string; url: string; inFile?: boolean };

const SECTIONS: { key: Hit["section"]; label: string; Icon: typeof FileText }[] = [
  { key: "documents", label: "Documents", Icon: FileText },
  { key: "trips", label: "Trips", Icon: Plane },
  { key: "dates", label: "Dates", Icon: CalendarHeart },
  { key: "money", label: "Money", Icon: Wallet },
  { key: "album", label: "Album", Icon: ImageIcon },
];

/**
 * Search everything: the top-bar button or Ctrl/⌘ K. Documents are matched
 * on their details and on the text inside the files; trips on every day's
 * story, places and highlight. ↑/↓ to move, Enter to open.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 30); }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/find?q=${encodeURIComponent(term)}`);
        const j = await r.json();
        if (mine === seq.current) { setHits(j.hits ?? []); setActive(0); }
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const ordered = useMemo(() => SECTIONS.flatMap((s) => hits.filter((h) => h.section === s.key)), [hits]);
  const go = (h: Hit) => { setOpen(false); setQ(""); router.push(h.url); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(ordered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && ordered[active]) go(ordered[active]);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Search everything (Ctrl K)" title="Search everything (Ctrl/⌘ K)" className="flex items-center gap-2" style={{ height: 32, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", color: "var(--faint)", fontSize: 13 }}>
        <Search size={15} /> <span className="hidden sm:inline">Search</span>
        <kbd className="hidden md:inline" style={{ fontSize: 11, padding: "1px 5px", borderRadius: 5, border: "1px solid var(--line)" }}>⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-center" style={{ background: "rgba(24,20,30,.45)", padding: "10vh 12px 12px" }} onClick={() => setOpen(false)}>
          <div className="card" role="dialog" aria-label="Search" style={{ width: "100%", maxWidth: 640, maxHeight: "75vh", display: "flex", flexDirection: "column", overflow: "hidden", alignSelf: "flex-start" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4" style={{ borderBottom: "1px solid var(--line)", height: 54 }}>
              {loading ? <Loader2 size={17} className="spin" color="var(--faint)" /> : <Search size={17} color="var(--faint)" />}
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search documents, trips, money, dates, photos…"
                aria-label="Search everything"
                className="flex-1"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 16 }}
              />
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={17} color="var(--faint)" /></button>
            </div>
            <div style={{ overflowY: "auto", padding: "6px 0" }}>
              {q.trim().length < 2 && (
                <p style={{ padding: "14px 18px", fontSize: 13.5, color: "var(--faint)" }}>
                  Try a policy or PAN number, a word from inside a PDF, a place from a trip, a shop, or someone&apos;s name.
                </p>
              )}
              {q.trim().length >= 2 && !loading && ordered.length === 0 && (
                <p style={{ padding: "14px 18px", fontSize: 13.5, color: "var(--faint)" }}>Nothing found for “{q.trim()}”.</p>
              )}
              {SECTIONS.map(({ key, label, Icon }) => {
                const list = ordered.filter((h) => h.section === key);
                if (!list.length) return null;
                return (
                  <div key={key} style={{ padding: "4px 0" }}>
                    <p style={{ padding: "6px 18px", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)" }}>{label}</p>
                    {list.map((h) => {
                      const idx = ordered.indexOf(h);
                      return (
                        <button
                          key={`${h.section}:${h.id}`}
                          onClick={() => go(h)}
                          onMouseEnter={() => setActive(idx)}
                          className="flex items-start gap-3 w-full text-left"
                          style={{ padding: "9px 18px", background: idx === active ? "var(--line2)" : "transparent" }}
                        >
                          <Icon size={16} color="var(--faint)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <span className="min-w-0">
                            <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{h.title}</span>
                            {h.sub && <span className="block truncate" style={{ fontSize: 12.5, color: h.inFile ? "var(--green)" : "var(--faint)" }}>{h.sub}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
