"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Check, ChevronLeft, FileText, Pencil, Pill, Plus, Stethoscope, Syringe, TestTube, Trash2, UserPlus } from "lucide-react";
import { Chip, inputStyle, labelStyle, Modal } from "@/components/dates/shared";
import {
  BLOOD_GROUPS, HEALTH_KIND_LABEL, HEALTH_KINDS, HEALTH_NEXT_LABEL, HEALTH_PEOPLE, comingUp, markDone,
  type HealthItem, type HealthKind, type HealthPerson, type HealthProfile,
} from "@/lib/health";

type Resp = { person: HealthPerson; people: HealthPerson[]; profile: HealthProfile; items: HealthItem[]; docs: { id: string; name: string; updatedAt: number; expiryDate: string | null }[] };

const fetcher = (u: string) => fetch(u).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load"); return j; });
async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Couldn't save");
  return j;
}
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const nice = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const ICON: Record<HealthKind, typeof Pill> = { visit: Stethoscope, medicine: Pill, test: TestTube, vaccine: Syringe };

function daysLabel(next: string, today: string): { text: string; urgent: boolean } {
  const d = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (d < 0) return { text: `overdue by ${-d} day${d === -1 ? "" : "s"}`, urgent: true };
  if (d === 0) return { text: "today", urgent: true };
  if (d === 1) return { text: "tomorrow", urgent: true };
  return { text: `in ${d} days · ${nice(next)}`, urgent: d <= 7 };
}

/**
 * Health — one page per person (Vamsi, Varshini, Parents): blood group,
 * allergies and conditions; what's coming up (check-ups, refills, repeat
 * tests, next doses — also sent as reminders); medicines; visits & tests;
 * vaccines; and their Medical documents from Documents.
 */
export function HealthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const p = params.get("p") || "vamsi";
  const { data, error, mutate } = useSWR<Resp>(`/api/health?p=${encodeURIComponent(p)}`, fetcher);
  const people = data?.people ?? HEALTH_PEOPLE;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ item?: HealthItem; kind: HealthKind } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const today = todayIST();

  const items = data?.items ?? [];
  const upcoming = comingUp(items, today);
  const medicines = items.filter((i) => i.kind === "medicine");
  const history = items.filter((i) => i.kind === "visit" || i.kind === "test");
  const vaccines = items.filter((i) => i.kind === "vaccine");

  const done = async (i: HealthItem) => {
    await send(`/api/health/items/${i.id}`, "PATCH", i.everyDays ? markDone(i, today) : { date: today, nextDate: null });
    mutate();
  };

  const section = (title: string, kind: HealthKind, list: HealthItem[], empty: string) => (
    <section className="card" style={{ padding: 18 }}>
      <div className="flex items-center justify-between mb-2">
        <p className="display" style={{ fontSize: 18 }}>{title}</p>
        <button className="btn btn-plain flex items-center gap-1" style={{ fontSize: 12.5, padding: "5px 10px" }} onClick={() => setForm({ kind })}><Plus size={13} /> Add</button>
      </div>
      {list.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)" }}>{empty}</p>}
      {list.map((i) => <Row key={i.id} i={i} today={today} onEdit={() => setForm({ item: i, kind: i.kind })} />)}
    </section>
  );

  return (
    <div>
      <div className="flex items-center gap-4 mb-5" style={{ flexWrap: "wrap" }}>
        <Link href="/" className="flex items-center justify-center card" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="Home"><ChevronLeft size={19} /></Link>
        <h1 className="display" style={{ fontSize: 30 }}>Health</h1>
        <div className="flex" style={{ gap: 4, padding: 4, borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", marginLeft: "auto" }} role="tablist">
          {people.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === (data?.person.id ?? p)} onClick={() => router.replace(`/health?p=${x.id}`)}
              style={{ padding: "7px 14px", borderRadius: 9, fontSize: 13.5, fontWeight: 600, background: x.id === (data?.person.id ?? p) ? "var(--ink)" : "transparent", color: x.id === (data?.person.id ?? p) ? "#fff" : "var(--ink)" }}>
              {x.name}
            </button>
          ))}
          <button onClick={() => setAdding(true)} aria-label="Add a family member" title="Add a family member (Amma, Appa…)" style={{ padding: "7px 10px", borderRadius: 9, color: "var(--faint)" }}>
            <UserPlus size={16} />
          </button>
        </div>
      </div>

      {error && <p className="card" style={{ padding: 14, color: "var(--red)" }}>{error.message}</p>}
      {!data && !error && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          <div style={{ display: "grid", gap: 16 }}>
            {upcoming.length > 0 && (
              <section className="card" style={{ padding: 18, borderColor: "var(--ink)" }}>
                <p className="display" style={{ fontSize: 18, marginBottom: 6 }}>Coming up</p>
                {upcoming.map((i) => {
                  const Icon = ICON[i.kind];
                  const due = daysLabel(i.nextDate!, today);
                  return (
                    <div key={i.id} className="flex items-center gap-3" style={{ padding: "9px 0", borderTop: "1px solid var(--line2)" }}>
                      <Icon size={16} color={due.urgent ? "var(--red)" : "var(--faint)"} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{i.title} — {HEALTH_NEXT_LABEL[i.kind].toLowerCase()}</span>
                        <span className="block" style={{ fontSize: 12.5, color: due.urgent ? "var(--red)" : "var(--faint)" }}>{due.text}{i.everyDays ? ` · every ${i.everyDays} days` : ""}</span>
                      </span>
                      <button className="btn btn-plain flex items-center gap-1" style={{ fontSize: 12.5, padding: "5px 10px" }} onClick={() => done(i)} title={i.everyDays ? `Done today — next one in ${i.everyDays} days` : "Done today"}>
                        <Check size={13} /> Done
                      </button>
                    </div>
                  );
                })}
              </section>
            )}
            {section("Medicines", "medicine", [...medicines.filter((m) => m.active !== false), ...medicines.filter((m) => m.active === false)], "Nothing yet — add regular medicines with a refill date to get a reminder.")}
            {section("Visits & tests", "visit", history, "Doctor visits, tests and scans, newest first.")}
            {section("Vaccines", "vaccine", vaccines, "Vaccines and their next doses.")}
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <section className="card" style={{ padding: 18 }}>
              <div className="flex items-center justify-between mb-2">
                <p className="display" style={{ fontSize: 18 }}>{data.person.name}{data.person.relation ? <span style={{ fontSize: 13, color: "var(--faint)" }}> · {data.person.relation}</span> : null}</p>
                <button onClick={() => setEditingProfile(true)} className="flex items-center gap-1" style={{ fontSize: 12.5, color: "var(--faint)" }}><Pencil size={12} /> Edit</button>
              </div>
              <Info label="Blood group" value={data.profile.bloodGroup ?? "—"} strong />
              <Info label="Allergies" value={data.profile.allergies.length ? data.profile.allergies.join(", ") : "None noted"} />
              <Info label="Conditions" value={data.profile.conditions.length ? data.profile.conditions.join(", ") : "None noted"} />
              {data.profile.notes && <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 8, whiteSpace: "pre-wrap" }}>{data.profile.notes}</p>}
              {data.person.custom && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`Remove ${data.person.name} from Health?`)) return;
                    try { await send(`/api/health/people/${data.person.id}`, "DELETE"); router.replace("/health?p=vamsi"); }
                    catch (e) { window.alert(e instanceof Error ? e.message : "Couldn't remove"); }
                  }}
                  className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--red)", marginTop: 10 }}
                >
                  <Trash2 size={12} /> Remove {data.person.name}
                </button>
              )}
            </section>
            <section className="card" style={{ padding: 18 }}>
              <p className="display" style={{ fontSize: 18, marginBottom: 6 }}>Medical documents</p>
              {data.docs.length === 0 && <p style={{ fontSize: 13, color: "var(--faint)" }}>Prescriptions and reports saved in Documents under “Medical” for {data.person.name} show here.</p>}
              {data.docs.map((d) => (
                <Link key={d.id} href={`/docs/${d.id}`} className="flex items-center gap-2" style={{ padding: "8px 0", borderTop: "1px solid var(--line2)", fontSize: 13.5 }}>
                  <FileText size={14} color="var(--faint)" /> <span className="flex-1 min-w-0 truncate">{d.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{new Date(d.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </Link>
              ))}
              <Link href="/docs" style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--indigo)" }}>Add in Documents</Link>
            </section>
          </div>
        </div>
      )}

      {form && data && <ItemForm person={data.person.id} kind={form.kind} item={form.item} onClose={() => setForm(null)} onSaved={() => { setForm(null); mutate(); }} />}
      {adding && <AddPerson onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); router.replace(`/health?p=${id}`); }} />}
      {editingProfile && data && <ProfileForm profile={data.profile} onClose={() => setEditingProfile(false)} onSaved={() => { setEditingProfile(false); mutate(); }} />}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ padding: "6px 0", fontSize: 13.5 }}>
      <span style={{ color: "var(--faint)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Row({ i, today, onEdit }: { i: HealthItem; today: string; onEdit: () => void }) {
  const Icon = ICON[i.kind];
  const stopped = i.kind === "medicine" && i.active === false;
  return (
    <button onClick={onEdit} className="flex items-start gap-3 w-full text-left" style={{ padding: "9px 0", borderTop: "1px solid var(--line2)", opacity: stopped ? 0.55 : 1 }}>
      <Icon size={16} color="var(--faint)" style={{ marginTop: 2, flexShrink: 0 }} />
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{i.title}{i.dose ? ` · ${i.dose}` : ""}{stopped ? " (stopped)" : ""}</span>
        <span className="block truncate" style={{ fontSize: 12.5, color: "var(--faint)" }}>
          {[i.kind !== "medicine" && i.kind !== "visit" ? HEALTH_KIND_LABEL[i.kind] : "", i.date ? nice(i.date) : "", i.doctor, i.nextDate ? `${HEALTH_NEXT_LABEL[i.kind]} ${daysLabel(i.nextDate, today).text}` : ""].filter(Boolean).join(" · ")}
        </span>
        {i.notes && <span className="block truncate" style={{ fontSize: 12, color: "var(--dim)" }}>{i.notes}</span>}
      </span>
      <Pencil size={13} color="var(--faint)" style={{ marginTop: 3, flexShrink: 0 }} />
    </button>
  );
}

function ItemForm({ person, kind: initialKind, item, onClose, onSaved }: { person: string; kind: HealthKind; item?: HealthItem; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<HealthKind>(item?.kind ?? initialKind);
  const [title, setTitle] = useState(item?.title ?? "");
  const [date, setDate] = useState(item?.date ?? (item ? "" : todayIST()));
  const [nextDate, setNextDate] = useState(item?.nextDate ?? "");
  const [every, setEvery] = useState(item?.everyDays ? String(item.everyDays) : "");
  const [doctor, setDoctor] = useState(item?.doctor ?? "");
  const [dose, setDose] = useState(item?.dose ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [active, setActive] = useState(item?.active !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const placeholder: Record<HealthKind, string> = { visit: "e.g. Dentist cleaning", medicine: "e.g. Thyronorm 50", test: "e.g. Thyroid profile", vaccine: "e.g. Tetanus booster" };

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const everyDays = Number(every) > 0 ? Math.round(Number(every)) : undefined;
      const common = {
        kind, title: title.trim(),
        doctor: doctor.trim() || undefined, dose: dose.trim() || undefined, notes: notes.trim() || undefined,
        ...(kind === "medicine" ? { active } : {}),
      };
      if (item) {
        // Editing: an emptied date / next date / repeat is cleared (null).
        await send(`/api/health/items/${item.id}`, "PATCH", { ...common, date: date || null, nextDate: nextDate || null, everyDays: everyDays ?? null });
      } else {
        await send("/api/health/items", "POST", { ...common, person, date: date || undefined, nextDate: nextDate || undefined, everyDays });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => { if (!item || !window.confirm(`Delete “${item.title}”?`)) return; await send(`/api/health/items/${item.id}`, "DELETE"); onSaved(); };

  return (
    <Modal title={item ? "Edit" : `Add ${HEALTH_KIND_LABEL[kind].toLowerCase()}`} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        {!item && <div className="flex flex-wrap" style={{ gap: 6 }}>{HEALTH_KINDS.map((k) => <Chip key={k} on={k === kind} onClick={() => setKind(k)}>{HEALTH_KIND_LABEL[k]}</Chip>)}</div>}
        <div><label style={labelStyle} htmlFor="h-title">What</label><input id="h-title" autoFocus style={inputStyle} placeholder={placeholder[kind]} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex" style={{ gap: 10 }}>
          <div className="flex-1"><label style={labelStyle} htmlFor="h-date">{kind === "medicine" ? "Started" : "Date"}</label><input id="h-date" type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="flex-1"><label style={labelStyle} htmlFor="h-next">{HEALTH_NEXT_LABEL[kind]}</label><input id="h-next" type="date" style={inputStyle} value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></div>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          <div className="flex-1"><label style={labelStyle} htmlFor="h-every">Repeats every (days)</label><input id="h-every" inputMode="numeric" style={inputStyle} placeholder={kind === "medicine" ? "e.g. 30" : kind === "visit" ? "e.g. 180" : "optional"} value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, ""))} /></div>
          {kind === "medicine"
            ? <div className="flex-1"><label style={labelStyle} htmlFor="h-dose">Dose</label><input id="h-dose" style={inputStyle} placeholder="e.g. 1 tablet before breakfast" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
            : <div className="flex-1"><label style={labelStyle} htmlFor="h-doc">Doctor / clinic</label><input id="h-doc" style={inputStyle} value={doctor} onChange={(e) => setDoctor(e.target.value)} /></div>}
        </div>
        <div><label style={labelStyle} htmlFor="h-notes">Notes</label><textarea id="h-notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {kind === "medicine" && (
          <label className="flex items-center gap-2" style={{ fontSize: 14 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 18, height: 18 }} /> Still taking it
          </label>
        )}
        <p style={{ fontSize: 12, color: "var(--faint)" }}>With a {HEALTH_NEXT_LABEL[kind].toLowerCase()} date you get a reminder a week before, the day before and on the day. With “repeats every”, tapping Done sets the next one for you.</p>
        {err && <p style={{ fontSize: 13, color: "var(--red)" }}>{err}</p>}
        <div className="flex" style={{ gap: 8 }}>
          {item && <button className="btn btn-plain flex items-center gap-1" style={{ color: "var(--red)" }} onClick={remove}><Trash2 size={14} /> Delete</button>}
          <button className="btn btn-dark flex-1" disabled={!title.trim() || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

function ProfileForm({ profile, onClose, onSaved }: { profile: HealthProfile; onClose: () => void; onSaved: () => void }) {
  const [blood, setBlood] = useState<string | null>(profile.bloodGroup ?? null);
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [conditions, setConditions] = useState(profile.conditions.join(", "));
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [busy, setBusy] = useState(false);
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    setBusy(true);
    try {
      await send("/api/health/profile", "PUT", { person: profile.person, bloodGroup: blood, allergies: list(allergies), conditions: list(conditions), notes: notes.trim() || undefined });
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Health details" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><span style={labelStyle}>Blood group</span><div className="flex flex-wrap" style={{ gap: 6 }}>{BLOOD_GROUPS.map((b) => <Chip key={b} on={blood === b} onClick={() => setBlood(blood === b ? null : b)}>{b}</Chip>)}</div></div>
        <div><label style={labelStyle} htmlFor="h-all">Allergies (comma separated)</label><input id="h-all" style={inputStyle} placeholder="e.g. Penicillin, peanuts" value={allergies} onChange={(e) => setAllergies(e.target.value)} /></div>
        <div><label style={labelStyle} htmlFor="h-cond">Conditions (comma separated)</label><input id="h-cond" style={inputStyle} placeholder="e.g. Hypothyroid" value={conditions} onChange={(e) => setConditions(e.target.value)} /></div>
        <div><label style={labelStyle} htmlFor="h-pnotes">Notes</label><textarea id="h-pnotes" rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Doctor's number, insurance card no., anything useful in a hurry" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button className="btn btn-dark" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

function AddPerson({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const { person } = await send("/api/health/people", "POST", { name: name.trim(), relation: relation.trim() || undefined });
      onAdded(person.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Add a family member" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label style={labelStyle} htmlFor="hp-name">Name</label><input id="hp-name" autoFocus style={inputStyle} placeholder="e.g. Amma" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label style={labelStyle} htmlFor="hp-rel">Relation (optional)</label><input id="hp-rel" style={inputStyle} placeholder="e.g. Vamsi's mother" value={relation} onChange={(e) => setRelation(e.target.value)} /></div>
        <p style={{ fontSize: 12, color: "var(--faint)" }}>They get their own medicines, visits, tests, vaccines and reminders. Their prescriptions and reports in Documents (owner “Parents”) show on their page when the file name mentions them, e.g. “Amma – thyroid report”.</p>
        {err && <p style={{ fontSize: 13, color: "var(--red)" }}>{err}</p>}
        <button className="btn btn-dark" disabled={!name.trim() || busy} onClick={save}>{busy ? "Adding…" : "Add"}</button>
      </div>
    </Modal>
  );
}
