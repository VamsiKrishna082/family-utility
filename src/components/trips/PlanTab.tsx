"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Circle, CloudRain, CloudSun, Copy, ExternalLink, Link2, MapPin, Navigation, Plus, RotateCcw, Snowflake, Star, Sun, ThumbsUp, CloudLightning, CloudFog } from "lucide-react";
import { dateOfDay, dayLabel, directionsLink, gapAfter, mapsLink, safeUrl, timelineClashes, todayIST } from "@/lib/trips/logic";
import { FA_PEOPLE } from "@/lib/fa/people";
import { CopyFromTrip } from "@/components/trips/CopyFromTrip";
import {
  BUDGET_KEYS, BUDGET_LABEL, PLAN_STATUSES, TRIP_BOOKING_KINDS, TRIP_BOOKING_LABEL,
  type BudgetKey, type DocCheckItem, type PlanItem, type PlanStatus, type StayOption, type StayStatus, type Trip, type TripBooking, type TripLink, type TripTodo, type TripWeatherResponse,
} from "@/lib/trips/types";
import { FieldForm, num, str, type Field } from "@/components/trips/FieldForm";
import { fetcher, rupees, Section, smallBtn, uid } from "@/components/trips/shared";

const PLAN_STATUS_STYLE: Record<PlanStatus, { label: string; ink: string; tint: string }> = {
  idea: { label: "Idea", ink: "#57519a", tint: "#eceaf3" },
  booked: { label: "Booked", ink: "#2f6e6b", tint: "#e5efee" },
  done: { label: "Done", ink: "#6b6774", tint: "#edeae4" },
};
const STAY_STATUS_STYLE: Record<StayStatus, { label: string; ink: string; tint: string }> = {
  option: { label: "Option", ink: "#6b6774", tint: "#edeae4" },
  shortlisted: { label: "Shortlisted", ink: "#a8741a", tint: "#f6ecd9" },
  booked: { label: "Booked", ink: "#2f6e6b", tint: "#e5efee" },
};
const nextOf = <T,>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];

function Pill({ s, onClick }: { s: { label: string; ink: string; tint: string }; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={onClick ? "Tap to change" : undefined} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: s.tint, color: s.ink, flexShrink: 0 }}>
      {s.label}
    </button>
  );
}

function weatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if (code <= 3) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 95) return CloudLightning;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return Snowflake;
  return CloudRain;
}

function ExtLink({ href, children }: { href?: string; children: React.ReactNode }) {
  const safe = safeUrl(href);
  if (!safe) return null;
  return <a href={safe} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 4, fontSize: 12.5, color: "var(--indigo)", fontWeight: 600 }}>{children} <ExternalLink size={11} /></a>;
}

/**
 * The planner: everything before (and during) the trip — forecast,
 * itinerary by day, where to stay, bookings, to-dos, saved links, budget
 * plan and packing. Every list saves straight into the trip.
 */
export function PlanTab({ trip, saveTrip, me, onChanged }: { trip: Trip; saveTrip: (patch: Partial<Trip>) => Promise<void>; me: { id: string; name: string }; onChanged: () => void }) {
  const today = todayIST();
  const { data: weather } = useSWR<TripWeatherResponse>(trip.destination ? `/api/trips/${trip.id}/weather` : null, fetcher);
  const { data: docs } = useSWR<{ items: DocCheckItem[]; checked: number }>(trip.endDate ? `/api/trips/${trip.id}/docs` : null, fetcher);
  const [copying, setCopying] = useState(false);
  const nameOf = (pid: string) => FA_PEOPLE.find((x) => x.id === pid)?.name ?? pid;
  const toggleVote = <T extends { id: string; votes?: string[] }>(list: T[], id: string): T[] =>
    list.map((x) => (x.id === id ? { ...x, votes: x.votes?.includes(me.id) ? x.votes.filter((v) => v !== me.id) : [...(x.votes ?? []), me.id] } : x));
  const votesOf = (x: { votes?: string[] }) => x.votes?.length ?? 0;
  const [form, setForm] = useState<null | { kind: "plan" | "stay" | "booking" | "link" | "todo"; id?: string; day?: number }>(null);
  const [packText, setPackText] = useState("");

  const dayOpts = Array.from({ length: trip.days }, (_, i) => ({
    value: String(i + 1),
    label: `Day ${i + 1}${trip.startDate ? ` · ${dayLabel(dateOfDay(trip.startDate, i + 1))}` : ""}`,
  }));

  /* ---------- itinerary ---------- */
  const planFields: Field[] = [
    { key: "title", label: "What", type: "text", required: true, placeholder: "e.g. Sunset at Chapora Fort" },
    { key: "day", label: "Day", type: "select", options: dayOpts },
    { key: "time", label: "Time", type: "time" },
    { key: "durationMin", label: "How long", type: "select", options: [30, 60, 90, 120, 180, 240, 360, 480].map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} h` })) },
    { key: "place", label: "Place", type: "text", placeholder: "Used for the Maps link" },
    { key: "link", label: "Link", type: "url", placeholder: "Blog, reel, booking page…" },
    { key: "estimateRupees", label: "Estimated cost (₹)", type: "number" },
    { key: "status", label: "Status", type: "select", required: true, options: PLAN_STATUSES.map((s) => ({ value: s, label: PLAN_STATUS_STYLE[s].label })) },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  const toPlan = (v: Record<string, string>, id: string): PlanItem => ({
    id, title: v.title, day: num(v.day), time: str(v.time), place: str(v.place), link: str(v.link),
    estimateRupees: num(v.estimateRupees), status: (v.status as PlanStatus) ?? "idea", notes: str(v.notes), durationMin: num(v.durationMin),
    votes: trip.plan.find((x) => x.id === id)?.votes,
  });
  const byTime = (a: PlanItem, b: PlanItem) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title);
  const unscheduled = trip.plan.filter((p) => !p.day || p.day > trip.days);
  const planEstimate = trip.plan.reduce((s, p) => s + (p.estimateRupees ?? 0), 0);

  const VoteButton = ({ votes, onClick }: { votes?: string[]; onClick: () => void }) => {
    const mine = votes?.includes(me.id);
    return (
      <button
        onClick={onClick}
        title={votes?.length ? `Liked by ${votes.map(nameOf).join(" & ")}` : "Like this"}
        className="flex items-center"
        style={{ gap: 3, fontSize: 12, fontWeight: 700, color: mine ? "#2f6e6b" : "var(--faint)" }}
        aria-pressed={mine}
        aria-label={mine ? "Remove your like" : "Like"}
      >
        <ThumbsUp size={14} fill={mine ? "#2f6e6b" : "none"} /> {votes?.length ? votes.length : ""}
      </button>
    );
  };

  const PlanRow = ({ p, clash, gap }: { p: PlanItem; clash?: string; gap?: number | null }) => (
    <>
    {gap !== undefined && gap !== null && gap >= 120 && (
      <p style={{ fontSize: 11.5, color: "var(--faint)", padding: "2px 0 2px 56px" }}>· {Math.floor(gap / 60)} h{gap % 60 ? ` ${gap % 60} m` : ""} free</p>
    )}
    <div className="flex items-start gap-3 py-2" style={{ borderTop: "1px solid var(--line2)" }}>
      <span style={{ width: 44, fontSize: 12.5, color: "var(--faint)", paddingTop: 2, flexShrink: 0 }}>{p.time ?? ""}</span>
      <button className="flex-1 min-w-0 text-left" onClick={() => setForm({ kind: "plan", id: p.id })}>
        <span className="block" style={{ fontSize: 14, fontWeight: 600, textDecoration: p.status === "done" ? "line-through" : undefined, color: p.status === "done" ? "var(--faint)" : undefined }}>{p.title}</span>
        {(p.notes || p.estimateRupees || p.durationMin) && (
          <span className="block truncate" style={{ fontSize: 12.5, color: "var(--faint)" }}>{[p.durationMin ? (p.durationMin < 60 ? `${p.durationMin} min` : `${p.durationMin / 60} h`) : "", p.estimateRupees ? rupees(p.estimateRupees) : "", p.notes].filter(Boolean).join(" · ")}</span>
        )}
        {clash && <span className="flex items-center" style={{ gap: 4, fontSize: 12, color: "var(--amber)", fontWeight: 600 }}><AlertTriangle size={12} /> Overlaps with {clash}</span>}
      </button>
      <span className="flex items-center" style={{ gap: 10, flexShrink: 0 }}>
        {p.place && <a href={mapsLink(p.place, trip.destination)} target="_blank" rel="noreferrer" aria-label={`${p.place} on Google Maps`}><MapPin size={15} color="var(--indigo)" /></a>}
        {safeUrl(p.link) && <a href={safeUrl(p.link)} target="_blank" rel="noreferrer" aria-label="Open link"><Link2 size={15} color="var(--indigo)" /></a>}
        <VoteButton votes={p.votes} onClick={() => saveTrip({ plan: toggleVote(trip.plan, p.id) })} />
        <Pill s={PLAN_STATUS_STYLE[p.status]} onClick={() => saveTrip({ plan: trip.plan.map((x) => (x.id === p.id ? { ...x, status: nextOf(PLAN_STATUSES, x.status) } : x)) })} />
      </span>
    </div>
    </>
  );

  /* ---------- stays ---------- */
  const stayFields: Field[] = [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Casa Anjuna" },
    { key: "link", label: "Link", type: "url", placeholder: "Booking.com / Airbnb / hotel site" },
    { key: "area", label: "Area", type: "text" },
    { key: "pricePerNightRupees", label: "Price per night (₹)", type: "number" },
    { key: "nights", label: "Nights", type: "number" },
    { key: "rating", label: "Your rating", type: "select", options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) })) },
    { key: "pros", label: "Pros", type: "textarea" },
    { key: "cons", label: "Cons", type: "textarea" },
    { key: "status", label: "Status", type: "select", required: true, options: (["option", "shortlisted", "booked"] as StayStatus[]).map((s) => ({ value: s, label: STAY_STATUS_STYLE[s].label })) },
  ];
  const toStay = (v: Record<string, string>, id: string): StayOption => ({
    id, name: v.name, link: str(v.link), area: str(v.area), pricePerNightRupees: num(v.pricePerNightRupees), nights: num(v.nights),
    rating: num(v.rating), pros: str(v.pros), cons: str(v.cons), status: (v.status as StayStatus) ?? "option",
    votes: trip.stays.find((x) => x.id === id)?.votes,
  });
  const stayRank: Record<StayStatus, number> = { booked: 0, shortlisted: 1, option: 2 };
  const stays = [...trip.stays].sort((a, b) => stayRank[a.status] - stayRank[b.status] || votesOf(b) - votesOf(a));
  const bookedStayCost = trip.stays.filter((s) => s.status === "booked").reduce((s, x) => s + (x.pricePerNightRupees ?? 0) * (x.nights ?? 1), 0);

  /* ---------- bookings / links / todos ---------- */
  const bookingFields: Field[] = [
    { key: "kind", label: "Type", type: "select", required: true, options: TRIP_BOOKING_KINDS.map((k) => ({ value: k, label: TRIP_BOOKING_LABEL[k] })) },
    { key: "title", label: "What", type: "text", required: true, placeholder: "e.g. 6E 532 BLR → GOI" },
    { key: "date", label: "Date", type: "date" },
    { key: "time", label: "Time", type: "time" },
    { key: "confirmation", label: "Confirmation / PNR", type: "text" },
    { key: "link", label: "Link", type: "url" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  const toBooking = (v: Record<string, string>, id: string): TripBooking => ({
    id, kind: (v.kind as TripBooking["kind"]) ?? "other", title: v.title, date: str(v.date), time: str(v.time), confirmation: str(v.confirmation), link: str(v.link), notes: str(v.notes),
  });
  const bookings = [...trip.bookings].sort((a, b) => `${a.date ?? "9999"}${a.time ?? ""}`.localeCompare(`${b.date ?? "9999"}${b.time ?? ""}`));

  const linkFields: Field[] = [
    { key: "title", label: "Title", type: "text", required: true, placeholder: "e.g. 10 hidden beaches in North Goa" },
    { key: "url", label: "Link", type: "url", required: true },
    { key: "note", label: "Note", type: "textarea" },
  ];
  const todoFields: Field[] = [
    { key: "text", label: "To-do", type: "text", required: true, placeholder: "e.g. Apply for leave" },
    { key: "due", label: "Due", type: "date" },
  ];

  /* ---------- budget ---------- */
  const budgetTotal = BUDGET_KEYS.reduce((s, k) => s + (trip.budgetPlan[k] ?? 0), 0);
  const packedCount = trip.packing.filter((p) => p.done).length;

  const editing = form?.id;
  const current = form && {
    plan: trip.plan.find((x) => x.id === editing),
    stay: trip.stays.find((x) => x.id === editing),
    booking: trip.bookings.find((x) => x.id === editing),
    link: trip.links.find((x) => x.id === editing),
    todo: trip.todos.find((x) => x.id === editing),
  }[form.kind];
  const asValues = (o: object | null | undefined) => (o ? Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== "id" && v !== undefined).map(([k, v]) => [k, String(v)])) : undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
      <div>
        <div className="flex flex-wrap mb-4" style={{ gap: 8 }}>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setCopying(true)}><Copy size={14} /> Copy from a past trip</button>
        </div>

        {docs && docs.items.length > 0 && (
          <div className="card mb-5" style={{ padding: 14, borderColor: "var(--amber)" }}>
            <p className="flex items-center" style={{ gap: 6, fontSize: 14, fontWeight: 700 }}><AlertTriangle size={15} color="var(--amber)" /> Check your documents</p>
            {docs.items.map((d) => (
              <p key={`${d.name}-${d.owner}`} style={{ fontSize: 13.5, marginTop: 6 }}>
                <strong>{d.name}</strong> ({d.owner}) — {d.problem === "expired" ? "expired" : d.problem === "expires_during" ? "expires during the trip" : "has under 6 months left when you're back"} · {dayLabel(d.expiryDate)}
              </p>
            ))}
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>From the Documents section. Many countries need 6 months of passport validity.</p>
          </div>
        )}

        {/* Weather */}
        {weather && (weather.days.length > 0 || weather.note) && (
          <Section title={`Weather${weather.place ? ` · ${weather.place}` : ""}`}>
            {weather.days.length ? (
              <div className="flex overflow-x-auto" style={{ gap: 8, paddingBottom: 4 }}>
                {weather.days.map((d) => {
                  const Icon = weatherIcon(d.code);
                  return (
                    <div key={d.date} className="flex flex-col items-center shrink-0" style={{ width: 78, padding: "10px 6px", borderRadius: 12, background: d.date === today ? "var(--ink)" : "var(--line2)", color: d.date === today ? "#fff" : "var(--ink)", gap: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700 }}>{dayLabel(d.date).split(",")[0]}</span>
                      <Icon size={22} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{d.max}° <span style={{ opacity: 0.6, fontWeight: 500 }}>{d.min}°</span></span>
                      <span style={{ fontSize: 11, opacity: 0.75 }}>{d.rainPct}% rain</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--faint)" }}>{weather.note}</p>
            )}
          </Section>
        )}

        {/* Itinerary */}
        <Section
          title="Itinerary"
          action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setForm({ kind: "plan" })}><Plus size={13} /> Add</button>}
        >
          {planEstimate > 0 && <p style={{ fontSize: 12.5, color: "var(--faint)", marginBottom: 8 }}>Estimated: {rupees(planEstimate)}</p>}
          {Array.from({ length: trip.days }, (_, i) => i + 1).map((day) => {
            const items = trip.plan.filter((p) => p.day === day).sort(byTime);
            const clashes = timelineClashes(items);
            const route = directionsLink(items.map((p) => p.place ?? "").filter(Boolean), trip.destination);
            return (
              <div key={day} className="mb-3">
                <div className="flex items-center justify-between" style={{ gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Day {day}{trip.startDate && <span style={{ color: "var(--faint)", fontWeight: 500 }}> · {dayLabel(dateOfDay(trip.startDate, day))}</span>}</p>
                  <span className="flex items-center" style={{ gap: 10 }}>
                    {route && <a href={route} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 4, fontSize: 12, color: "var(--indigo)", fontWeight: 600 }}><Navigation size={12} /> Route for the day</a>}
                    <button onClick={() => setForm({ kind: "plan", day })} aria-label={`Add to day ${day}`}><Plus size={14} color="var(--faint)" /></button>
                  </span>
                </div>
                {items.map((p, i) => <PlanRow key={p.id} p={p} clash={clashes.get(p.id)} gap={i > 0 ? gapAfter(items[i - 1], p) : undefined} />)}
                {!items.length && <p style={{ fontSize: 12.5, color: "var(--faint)", padding: "4px 0" }}>Nothing planned yet.</p>}
              </div>
            );
          })}
          {unscheduled.length > 0 && (
            <div className="mt-2">
              <p style={{ fontSize: 13, fontWeight: 700 }}>Ideas, not on a day yet</p>
              {unscheduled.sort((a, b) => votesOf(b) - votesOf(a) || byTime(a, b)).map((p) => <PlanRow key={p.id} p={p} />)}
            </div>
          )}
        </Section>

        {/* Stays */}
        <Section
          title="Where to stay"
          action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setForm({ kind: "stay" })}><Plus size={13} /> Add option</button>}
        >
          {!stays.length && <p style={{ fontSize: 13.5, color: "var(--faint)" }}>Collect hotel and homestay options here, shortlist, then mark the one you book.</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {stays.map((s) => (
              <div key={s.id} className="card" style={{ padding: 12, borderColor: s.status === "booked" ? "#2f6e6b" : undefined }}>
                <div className="flex items-start gap-2">
                  <button className="flex-1 min-w-0 text-left" onClick={() => setForm({ kind: "stay", id: s.id })}>
                    <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                    <span className="block" style={{ fontSize: 12.5, color: "var(--faint)" }}>
                      {[s.area, s.pricePerNightRupees ? `${rupees(s.pricePerNightRupees)}/night` : "", s.pricePerNightRupees && s.nights ? `${rupees(s.pricePerNightRupees * s.nights)} for ${s.nights} nights` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  <VoteButton votes={s.votes} onClick={() => saveTrip({ stays: toggleVote(trip.stays, s.id) })} />
                  <Pill s={STAY_STATUS_STYLE[s.status]} onClick={() => saveTrip({ stays: trip.stays.map((x) => (x.id === s.id ? { ...x, status: nextOf(["option", "shortlisted", "booked"] as const, x.status) } : x)) })} />
                </div>
                {s.rating && <p style={{ marginTop: 4 }}>{Array.from({ length: s.rating }, (_, i) => <Star key={i} size={12} fill="#a8741a" color="#a8741a" style={{ display: "inline" }} />)}</p>}
                {(s.pros || s.cons) && (
                  <p style={{ fontSize: 12.5, marginTop: 4 }}>
                    {s.pros && <span style={{ color: "#2f6e6b" }}>+ {s.pros} </span>}
                    {s.cons && <span style={{ color: "var(--red)" }}>− {s.cons}</span>}
                  </p>
                )}
                <div className="mt-1"><ExtLink href={s.link}>Open listing</ExtLink></div>
              </div>
            ))}
          </div>
        </Section>

        {/* Links */}
        <Section
          title="Saved links & ideas"
          action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setForm({ kind: "link" })}><Plus size={13} /> Add</button>}
        >
          {!trip.links.length && <p style={{ fontSize: 13.5, color: "var(--faint)" }}>Blogs, reels, restaurant lists, Maps pins — anything you want to come back to.</p>}
          {trip.links.map((l) => (
            <div key={l.id} className="flex items-start gap-3 py-2" style={{ borderTop: "1px solid var(--line2)" }}>
              <Link2 size={15} color="var(--faint)" style={{ marginTop: 3, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                {safeUrl(l.url) ? (
                  <a href={safeUrl(l.url)} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--indigo)" }}>{l.title}</a>
                ) : <span style={{ fontSize: 14, fontWeight: 600 }}>{l.title}</span>}
                {l.note && <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{l.note}</p>}
              </div>
              <button onClick={() => setForm({ kind: "link", id: l.id })} style={{ fontSize: 12, color: "var(--faint)" }}>Edit</button>
            </div>
          ))}
        </Section>
      </div>

      <div>
        {/* To-dos */}
        <Section
          title="Before we go"
          action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setForm({ kind: "todo" })}><Plus size={13} /> Add</button>}
        >
          {[...trip.todos].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999")).map((t) => {
            const overdue = !t.done && t.due && t.due < today;
            return (
              <div key={t.id} className="flex items-center gap-2 py-1.5">
                <button onClick={() => saveTrip({ todos: trip.todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} aria-label={t.done ? "Mark not done" : "Mark done"}>
                  {t.done ? <CheckCircle2 size={18} color="#2f6e6b" /> : <Circle size={18} color="var(--faint)" />}
                </button>
                <button className="flex-1 text-left" style={{ fontSize: 14, color: t.done ? "var(--faint)" : undefined, textDecoration: t.done ? "line-through" : undefined }} onClick={() => setForm({ kind: "todo", id: t.id })}>{t.text}</button>
                {t.due && <span style={{ fontSize: 12, color: overdue ? "var(--red)" : "var(--faint)", fontWeight: overdue ? 700 : 400 }}>{dayLabel(t.due)}</span>}
              </div>
            );
          })}
        </Section>

        {/* Bookings */}
        <Section
          title="Bookings"
          action={<button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setForm({ kind: "booking" })}><Plus size={13} /> Add</button>}
        >
          {!bookings.length && <p style={{ fontSize: 13.5, color: "var(--faint)" }}>Flights, trains, stays and activities — with the PNR handy.</p>}
          <p className="flex items-start" style={{ gap: 6, fontSize: 12, color: "var(--faint)", marginBottom: 6 }}>
            <CalendarClock size={13} style={{ marginTop: 1, flexShrink: 0 }} /> Dated bookings (and to-dos with a due date) show up in your phone calendar with alerts — set it up once from Dates → Calendar sync.
          </p>
          {bookings.map((b) => (
            <button key={b.id} className="w-full text-left py-2" style={{ borderTop: "1px solid var(--line2)" }} onClick={() => setForm({ kind: "booking", id: b.id })}>
              <span className="flex items-center gap-2">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", width: 58, flexShrink: 0 }}>{TRIP_BOOKING_LABEL[b.kind]}</span>
                <span className="flex-1 truncate" style={{ fontSize: 14, fontWeight: 600 }}>{b.title}</span>
              </span>
              <span className="block" style={{ fontSize: 12.5, color: "var(--faint)", paddingLeft: 66 }}>
                {[b.date ? dayLabel(b.date) : "", b.time, b.confirmation ? `PNR ${b.confirmation}` : ""].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </Section>

        {/* Budget */}
        <Section title="Budget plan">
          <div style={{ display: "grid", gap: 8 }}>
            {BUDGET_KEYS.map((k: BudgetKey) => (
              <label key={k} className="flex items-center justify-between" style={{ gap: 10, fontSize: 14 }}>
                {BUDGET_LABEL[k]}
                <input
                  inputMode="numeric"
                  aria-label={`${BUDGET_LABEL[k]} budget`}
                  defaultValue={trip.budgetPlan[k] ?? ""}
                  placeholder="₹"
                  onBlur={(e) => {
                    const v = Number(e.target.value.replace(/[^\d.]/g, ""));
                    if ((trip.budgetPlan[k] ?? 0) !== (v || 0)) {
                      const next = { ...trip.budgetPlan };
                      if (v > 0) next[k] = v; else delete next[k];
                      saveTrip({ budgetPlan: next });
                    }
                  }}
                  style={{ width: 120, borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 14, textAlign: "right" }}
                />
              </label>
            ))}
            <div className="flex justify-between" style={{ borderTop: "1px solid var(--line2)", paddingTop: 8, fontSize: 14, fontWeight: 700 }}>
              <span>Planned total</span><span>{rupees(budgetTotal)}</span>
            </div>
            {(() => {
              const budget = trip.budgetRupees ?? budgetTotal;
              const shortlisted = trip.stays.filter((x) => x.status !== "option").reduce((sum, x) => sum + (x.pricePerNightRupees ?? 0) * (x.nights ?? 1), 0);
              const estimate = planEstimate + (shortlisted || bookedStayCost);
              if (!budget || !estimate) return null;
              const pct = Math.min(100, (estimate / budget) * 100);
              return (
                <div style={{ marginTop: 4 }}>
                  <div className="flex justify-between" style={{ fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ color: "var(--faint)" }}>Estimated so far</span>
                    <span style={{ fontWeight: 700, color: estimate > budget ? "var(--red)" : undefined }}>{rupees(estimate)} of {rupees(budget)}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--line2)", overflow: "hidden" }}>
                    <div style={{ height: 6, width: `${pct}%`, background: estimate > budget ? "var(--red)" : "#1b8a6b" }} />
                  </div>
                </div>
              );
            })()}
            {(planEstimate > 0 || bookedStayCost > 0) && (
              <p style={{ fontSize: 12.5, color: "var(--faint)" }}>
                So far: {[planEstimate ? `${rupees(planEstimate)} in itinerary estimates` : "", bookedStayCost ? `${rupees(bookedStayCost)} booked stays` : ""].filter(Boolean).join(" · ")}. Actual spend is on the Expenses tab.
              </p>
            )}
          </div>
        </Section>

        {/* Packing */}
        <Section
          title={`Packing · ${packedCount}/${trip.packing.length}`}
          action={packedCount > 0 ? <button className="flex items-center gap-1" style={{ fontSize: 12.5, color: "var(--faint)" }} onClick={() => saveTrip({ packing: trip.packing.map((p) => ({ ...p, done: false })) })}><RotateCcw size={12} /> Unpack all</button> : undefined}
        >
          <div className="fa-bar mb-3" style={{ height: 6, borderRadius: 6, background: "var(--line2)", overflow: "hidden" }}>
            <div style={{ height: 6, width: `${trip.packing.length ? (packedCount / trip.packing.length) * 100 : 0}%`, background: "#2f6e6b", transition: "width .3s ease" }} />
          </div>
          {trip.packing.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1 group">
              <button onClick={() => saveTrip({ packing: trip.packing.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)) })} className="flex items-center gap-2 flex-1 text-left">
                <span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${p.done ? "#2f6e6b" : "var(--faint)"}`, background: p.done ? "#2f6e6b" : "transparent" }}>
                  {p.done && <Check size={12} color="#fff" />}
                </span>
                <span style={{ fontSize: 14, color: p.done ? "var(--faint)" : undefined, textDecoration: p.done ? "line-through" : undefined }}>{p.text}</span>
              </button>
              <button className="opacity-0 group-hover:opacity-100" style={{ fontSize: 12, color: "var(--faint)" }} onClick={() => saveTrip({ packing: trip.packing.filter((x) => x.id !== p.id) })}>Remove</button>
            </div>
          ))}
          <div className="flex mt-2" style={{ gap: 8 }}>
            <input
              value={packText}
              onChange={(e) => setPackText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && packText.trim()) { saveTrip({ packing: [...trip.packing, { id: uid(), text: packText.trim(), done: false }] }); setPackText(""); } }}
              placeholder="Add an item"
              aria-label="Add packing item"
              style={{ flex: 1, borderRadius: 10, border: "1px solid var(--line)", padding: "7px 10px", fontSize: 14 }}
            />
          </div>
        </Section>
      </div>

      {copying && <CopyFromTrip trip={trip} onClose={() => setCopying(false)} onDone={onChanged} />}

      {/* Forms */}
      {form?.kind === "plan" && (
        <FieldForm
          title={editing ? "Edit plan" : "Add to the plan"}
          fields={planFields}
          initial={asValues(current) ?? { status: "idea", ...(form.day ? { day: String(form.day) } : {}) }}
          onClose={() => setForm(null)}
          onSubmit={(v) => saveTrip({ plan: editing ? trip.plan.map((x) => (x.id === editing ? toPlan(v, editing) : x)) : [...trip.plan, toPlan(v, uid())] })}
          onDelete={editing ? () => saveTrip({ plan: trip.plan.filter((x) => x.id !== editing) }) : undefined}
        />
      )}
      {form?.kind === "stay" && (
        <FieldForm
          title={editing ? "Edit stay" : "Add a stay option"}
          fields={stayFields}
          initial={asValues(current) ?? { status: "option", ...(trip.days > 1 ? { nights: String(trip.days - 1) } : {}) }}
          onClose={() => setForm(null)}
          onSubmit={(v) => saveTrip({ stays: editing ? trip.stays.map((x) => (x.id === editing ? toStay(v, editing) : x)) : [...trip.stays, toStay(v, uid())] })}
          onDelete={editing ? () => saveTrip({ stays: trip.stays.filter((x) => x.id !== editing) }) : undefined}
        />
      )}
      {form?.kind === "booking" && (
        <FieldForm
          title={editing ? "Edit booking" : "Add a booking"}
          fields={bookingFields}
          initial={asValues(current) ?? { kind: "flight", ...(trip.startDate ? { date: trip.startDate } : {}) }}
          onClose={() => setForm(null)}
          onSubmit={(v) => saveTrip({ bookings: editing ? trip.bookings.map((x) => (x.id === editing ? toBooking(v, editing) : x)) : [...trip.bookings, toBooking(v, uid())] })}
          onDelete={editing ? () => saveTrip({ bookings: trip.bookings.filter((x) => x.id !== editing) }) : undefined}
        />
      )}
      {form?.kind === "link" && (
        <FieldForm
          title={editing ? "Edit link" : "Save a link"}
          fields={linkFields}
          initial={asValues(current)}
          onClose={() => setForm(null)}
          onSubmit={(v) => {
            const l: TripLink = { id: editing ?? uid(), title: v.title, url: v.url, note: str(v.note) };
            return saveTrip({ links: editing ? trip.links.map((x) => (x.id === editing ? l : x)) : [...trip.links, l] });
          }}
          onDelete={editing ? () => saveTrip({ links: trip.links.filter((x) => x.id !== editing) }) : undefined}
        />
      )}
      {form?.kind === "todo" && (
        <FieldForm
          title={editing ? "Edit to-do" : "Add a to-do"}
          fields={todoFields}
          initial={asValues(current && { text: (current as TripTodo).text, due: (current as TripTodo).due })}
          onClose={() => setForm(null)}
          onSubmit={(v) => {
            const done = (current as TripTodo | undefined)?.done ?? false;
            const t: TripTodo = { id: editing ?? uid(), text: v.text, due: str(v.due), done };
            return saveTrip({ todos: editing ? trip.todos.map((x) => (x.id === editing ? t : x)) : [...trip.todos, t] });
          }}
          onDelete={editing ? () => saveTrip({ todos: trip.todos.filter((x) => x.id !== editing) }) : undefined}
        />
      )}
    </div>
  );
}
