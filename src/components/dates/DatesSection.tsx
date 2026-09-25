"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, MessageCircle, Plus, Search } from "lucide-react";
import {
  bucketOf, countdownLabel, greeting, isMilestone, MONTHS, MONTHS_LONG, onYear, weekday, whatsappLink, yearsLabel, type Ymd,
} from "@/lib/dates/logic";
import { DT_RELATIONS, DT_RELATION_LABEL, DT_TYPES, DT_TYPE_LABEL, type DtEvent, type DtType } from "@/lib/dates/types";
import { CalendarSync } from "@/components/dates/CalendarSync";
import { DateDetail } from "@/components/dates/DateDetail";
import { DateForm } from "@/components/dates/DateForm";
import { Chip, TYPE_COLOR, TypeIcon, useDates, type Row } from "@/components/dates/shared";

type Tab = "upcoming" | "calendar" | "people";

function DateRow({ row, onOpen, showCountdown = true }: { row: Row; onOpen: () => void; showCountdown?: boolean }) {
  const { ev, occ } = row;
  const label = yearsLabel(ev.type, occ.years);
  const milestone = isMilestone(ev.type, occ.years);
  const c = TYPE_COLOR[ev.type];
  const soon = occ.daysAway >= 0 && occ.daysAway <= 7;
  return (
    <button onClick={onOpen} className="flex items-center gap-3 w-full text-left px-4 py-3" style={{ borderTop: "1px solid var(--line2)" }}>
      <span className="flex flex-col items-center justify-center shrink-0" style={{ width: 46, height: 46, borderRadius: 12, background: c.tint, color: c.ink }}>
        <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{occ.date.d}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{MONTHS[occ.date.m - 1]}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{ev.title}</span>
          {milestone && <span style={{ padding: "1px 7px", borderRadius: 999, background: c.tint, color: c.ink, fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>MILESTONE</span>}
        </span>
        <span className="block truncate" style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>
          {weekday(occ.date)}{label ? ` · ${label}` : ""}{ev.relation ? ` · ${DT_RELATION_LABEL[ev.relation]}` : ""}
        </span>
      </span>
      {showCountdown && (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: soon ? "var(--amber)" : "var(--faint)", flexShrink: 0 }}>
          {occ.past ? "Past" : countdownLabel(occ.daysAway)}
        </span>
      )}
    </button>
  );
}

function Group({ title, rows, onOpen }: { title: string; rows: Row[]; onOpen: (id: string) => void }) {
  if (!rows.length) return null;
  return (
    <section className="card mb-5" style={{ overflow: "hidden" }}>
      <p className="px-4 pt-3 pb-2" style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</p>
      {rows.map((r) => <DateRow key={r.ev.id} row={r} onOpen={() => onOpen(r.ev.id)} />)}
    </section>
  );
}

/** Every date that lands in a given month of a given year (recurring ones on that year's day). */
function inMonth(items: DtEvent[], year: number, month: number): Map<number, DtEvent[]> {
  const out = new Map<number, DtEvent[]>();
  for (const ev of items) {
    let date: Ymd | null = null;
    if (ev.recurring) {
      if (ev.year && ev.year > year) continue;
      const d = onYear(ev.month, ev.day, year);
      if (d.m === month) date = d;
    } else if (ev.year === year && ev.month === month) {
      date = onYear(ev.month, ev.day, year);
    }
    if (date) out.set(date.d, [...(out.get(date.d) ?? []), ev]);
  }
  return out;
}

export function DatesSection() {
  const { rows, today, data, error, isLoading, mutate } = useDates();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [form, setForm] = useState<{ editing?: DtEvent; type?: DtType } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<DtType | null>(null);
  const [cal, setCal] = useState<{ y: number; m: number }>({ y: today.y, m: today.m });
  const [calDay, setCalDay] = useState<number | null>(today.d);

  const detailRow = rows.find((r) => r.ev.id === detailId) ?? null;
  const todays = rows.filter((r) => r.occ.daysAway === 0);

  const buckets = useMemo(() => {
    const b = { week: [] as Row[], month: [] as Row[], later: [] as Row[], past: [] as Row[] };
    for (const r of rows) {
      const k = bucketOf(r.occ.daysAway, today, r.occ.date);
      if (k !== "today") b[k].push(r);
    }
    return b;
  }, [rows, today]);

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = rows.filter((r) =>
      (!typeFilter || r.ev.type === typeFilter) &&
      (!needle || `${r.ev.title} ${r.ev.person ?? ""} ${r.ev.notes}`.toLowerCase().includes(needle)),
    );
    const byMonthDay = (a: Row, b: Row) => a.ev.month - b.ev.month || a.ev.day - b.ev.day;
    const groups = DT_RELATIONS.map((rel) => ({ key: rel, title: DT_RELATION_LABEL[rel], rows: matches.filter((r) => r.ev.relation === rel).sort(byMonthDay) }));
    groups.push({ key: "none" as never, title: "Festivals & other", rows: matches.filter((r) => !r.ev.relation).sort(byMonthDay) });
    return groups.filter((g) => g.rows.length);
  }, [rows, q, typeFilter]);

  const monthMap = useMemo(() => inMonth(data?.items ?? [], cal.y, cal.m), [data, cal]);
  const firstWeekday = (new Date(Date.UTC(cal.y, cal.m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysIn = new Date(Date.UTC(cal.y, cal.m, 0)).getUTCDate();
  const shiftCal = (delta: number) => {
    const m0 = cal.m - 1 + delta;
    setCal({ y: cal.y + Math.floor(m0 / 12), m: ((m0 % 12) + 12) % 12 + 1 });
    setCalDay(null);
  };

  const empty = !isLoading && rows.length === 0;

  return (
    <div>
      <div className="flex items-start gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <Link href="/" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="Home">
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1" style={{ minWidth: 180 }}>
          <h1 className="display" style={{ fontSize: 30 }}>Dates</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Birthdays, anniversaries and the days that matter.</p>
        </div>
        <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setSyncOpen(true)}>
            <CalendarClock size={15} /> <span className="hidden sm:inline">Calendar sync</span>
          </button>
          <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setForm({})}>
            <Plus size={15} /> <span className="hidden sm:inline">Add date</span>
          </button>
        </div>
      </div>

      {error && <div className="card mb-5" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>}

      {todays.length > 0 && (
        <section className="mb-6" style={{ borderRadius: 18, padding: 20, background: "var(--ink)", color: "#fff" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.7 }}>Today · {weekday(today, "long")}, {today.d} {MONTHS_LONG[today.m - 1]}</p>
          {todays.map(({ ev, occ }) => {
            const label = yearsLabel(ev.type, occ.years);
            return (
              <div key={ev.id} className="flex items-center gap-3 mt-3" style={{ flexWrap: "wrap" }}>
                <TypeIcon type={ev.type} size={40} />
                <button className="flex-1 text-left min-w-0" onClick={() => setDetailId(ev.id)}>
                  <p className="display truncate" style={{ fontSize: 22 }}>{ev.title}</p>
                  {label && <p style={{ fontSize: 13, opacity: 0.75 }}>{label[0].toUpperCase() + label.slice(1)}{isMilestone(ev.type, occ.years) ? " · a milestone" : ""}</p>}
                </button>
                <a className="btn flex items-center gap-1.5" style={{ background: "#fff", color: "var(--ink)" }} href={whatsappLink(ev.phone, greeting(ev, occ.years))} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} /> {ev.type === "remembrance" ? "Message" : "Wish"}
                </a>
              </div>
            );
          })}
        </section>
      )}

      {empty ? (
        <div className="card text-center" style={{ padding: "40px 20px" }}>
          <p className="display" style={{ fontSize: 22 }}>Never miss a day that matters</p>
          <p style={{ color: "var(--faint)", fontSize: 14, marginTop: 8 }}>Add birthdays, anniversaries and remembrance days — you&apos;ll see what&apos;s coming, and get reminders on your phone.</p>
          <div className="flex flex-wrap justify-center mt-5" style={{ gap: 8 }}>
            {(["birthday", "anniversary", "remembrance", "festival"] as DtType[]).map((t) => (
              <button key={t} className="btn btn-plain flex items-center gap-2" onClick={() => setForm({ type: t })}>
                <TypeIcon type={t} size={24} /> Add a {DT_TYPE_LABEL[t].toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex mb-5" style={{ gap: 4, padding: 4, borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", width: "fit-content" }} role="tablist">
            {(["upcoming", "calendar", "people"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13.5, fontWeight: 600, background: tab === t ? "var(--ink)" : "transparent", color: tab === t ? "#fff" : "var(--dim)" }}
              >
                {t === "upcoming" ? "Upcoming" : t === "calendar" ? "Calendar" : "Everyone"}
              </button>
            ))}
          </div>

          {isLoading && !data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}

          {tab === "upcoming" && (
            <>
              <Group title="This week" rows={buckets.week} onOpen={setDetailId} />
              <Group title="This month" rows={buckets.month} onOpen={setDetailId} />
              <Group title="Later this year and beyond" rows={buckets.later} onOpen={setDetailId} />
              <Group title="Already happened (one-time)" rows={buckets.past} onOpen={setDetailId} />
            </>
          )}

          {tab === "calendar" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
              <section className="card" style={{ padding: 16 }}>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => shiftCal(-1)} aria-label="Previous month" className="btn btn-plain" style={{ padding: "6px 10px" }}><ChevronLeft size={16} /></button>
                  <p className="display" style={{ fontSize: 19 }}>{MONTHS_LONG[cal.m - 1]} {cal.y}</p>
                  <button onClick={() => shiftCal(1)} aria-label="Next month" className="btn btn-plain" style={{ padding: "6px 10px" }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d} style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", fontWeight: 700 }}>{d}</span>
                  ))}
                  {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
                  {Array.from({ length: daysIn }, (_, i) => i + 1).map((d) => {
                    const evs = monthMap.get(d) ?? [];
                    const isToday = cal.y === today.y && cal.m === today.m && d === today.d;
                    const selected = calDay === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setCalDay(d)}
                        aria-label={`${d} ${MONTHS_LONG[cal.m - 1]}${evs.length ? `, ${evs.length} date${evs.length > 1 ? "s" : ""}` : ""}`}
                        className="flex flex-col items-center"
                        style={{
                          minHeight: 54, padding: "6px 2px", borderRadius: 10, gap: 4,
                          border: `1px solid ${selected ? "var(--ink)" : isToday ? "var(--amber)" : "var(--line2)"}`,
                          background: selected ? "var(--ink)" : "var(--card)",
                          color: selected ? "#fff" : "var(--ink)",
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: isToday ? 800 : 600 }}>{d}</span>
                        <span className="flex flex-wrap justify-center" style={{ gap: 3 }}>
                          {evs.slice(0, 3).map((ev) => <span key={ev.id} style={{ width: 7, height: 7, borderRadius: 7, background: TYPE_COLOR[ev.type].ink }} />)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap mt-3" style={{ gap: 12, fontSize: 12, color: "var(--faint)" }}>
                  {DT_TYPES.map((t) => (
                    <span key={t} className="flex items-center" style={{ gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: TYPE_COLOR[t].ink }} /> {DT_TYPE_LABEL[t]}
                    </span>
                  ))}
                </div>
              </section>
              <section className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
                <p className="px-4 pt-3 pb-2" style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
                  {calDay ? `${calDay} ${MONTHS_LONG[cal.m - 1]}` : `${MONTHS_LONG[cal.m - 1]} — all`}
                </p>
                {(() => {
                  const ids = new Set((calDay ? monthMap.get(calDay) ?? [] : [...monthMap.values()].flat()).map((e) => e.id));
                  const list = rows.filter((r) => ids.has(r.ev.id)).sort((a, b) => a.ev.day - b.ev.day);
                  return list.length ? (
                    list.map((r) => <DateRow key={r.ev.id} row={r} onOpen={() => setDetailId(r.ev.id)} />)
                  ) : (
                    <p className="px-4 pb-4" style={{ fontSize: 14, color: "var(--faint)" }}>Nothing on this day.</p>
                  );
                })()}
              </section>
            </div>
          )}

          {tab === "people" && (
            <>
              <div className="card flex items-center gap-2 mb-3" style={{ padding: "8px 12px" }}>
                <Search size={15} color="var(--faint)" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, notes…" className="flex-1 outline-none" style={{ fontSize: 14, background: "transparent" }} aria-label="Search dates" />
              </div>
              <div className="flex flex-wrap mb-5" style={{ gap: 8 }}>
                <Chip on={typeFilter === null} onClick={() => setTypeFilter(null)}>All</Chip>
                {DT_TYPES.map((t) => <Chip key={t} on={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>{DT_TYPE_LABEL[t]}</Chip>)}
              </div>
              {people.length === 0 && <p style={{ color: "var(--faint)", fontSize: 14 }}>No matches.</p>}
              {people.map((g) => <Group key={g.key} title={`${g.title} · ${g.rows.length}`} rows={g.rows} onOpen={setDetailId} />)}
            </>
          )}
        </>
      )}

      {form && (
        <DateForm
          editing={form.editing}
          initialType={form.type}
          onClose={() => setForm(null)}
          onSaved={(id) => { mutate(); if (!form.editing) setDetailId(id); }}
        />
      )}
      {detailRow && !form && (
        <DateDetail
          key={`${detailRow.ev.id}-${detailRow.ev.updatedAt}`}
          row={detailRow}
          onClose={() => setDetailId(null)}
          onEdit={() => setForm({ editing: detailRow.ev })}
          onChanged={() => mutate()}
        />
      )}
      {syncOpen && <CalendarSync onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
