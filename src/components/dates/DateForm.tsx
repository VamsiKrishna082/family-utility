"use client";

import { useState } from "react";
import { autoTitle, MONTHS_LONG, todayIST } from "@/lib/dates/logic";
import {
  DT_RELATIONS, DT_RELATION_LABEL, DT_REMIND_OPTIONS, DT_SIDES, DT_SIDE_LABEL, DT_TYPES, DT_TYPE_LABEL,
  type DtEvent, type DtRelation, type DtSide, type DtType,
} from "@/lib/dates/types";
import { Chip, inputStyle, labelStyle, Modal, send } from "@/components/dates/shared";

const PERSON_TYPES: DtType[] = ["birthday", "anniversary", "remembrance"];
const remindLabel = (n: number) => (n === 0 ? "On the day" : n === 1 ? "1 day before" : `${n} days before`);

/** Add or edit a date. The title writes itself from the person ("Amma's birthday") until you change it. */
export function DateForm({ editing, initialType, onClose, onSaved }: { editing?: DtEvent; initialType?: DtType; onClose: () => void; onSaved: (id: string) => void }) {
  const today = todayIST();
  const [type, setType] = useState<DtType>(editing?.type ?? initialType ?? "birthday");
  const [person, setPerson] = useState(editing?.person ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(editing));
  const [day, setDay] = useState(editing?.day ?? today.d);
  const [month, setMonth] = useState(editing?.month ?? today.m);
  const [year, setYear] = useState(editing?.year ? String(editing.year) : "");
  const [recurring, setRecurring] = useState(editing?.recurring ?? true);
  const [relation, setRelation] = useState<DtRelation | undefined>(editing?.relation);
  const [side, setSide] = useState<DtSide | undefined>(editing?.side);
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [remindDays, setRemindDays] = useState<number[]>(editing?.remindDays ?? [1, 0]);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsPerson = PERSON_TYPES.includes(type);
  const shownTitle = titleTouched ? title : autoTitle(type, person, title);
  const yearN = Number(year) || undefined;
  const canSave = Boolean(shownTitle.trim()) && (!needsPerson || person.trim()) && (recurring || yearN);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        type,
        title: shownTitle.trim(),
        person: needsPerson ? person.trim() || undefined : undefined,
        relation: type === "festival" ? undefined : relation,
        side: type === "festival" ? undefined : side,
        month, day,
        year: yearN,
        recurring,
        phone: phone.trim() || undefined,
        notes,
        remindDays,
      };
      if (editing) {
        // null clears a field that was set before and is now empty
        const clear = (k: keyof typeof body) => (body[k] === undefined && editing[k as keyof DtEvent] !== undefined ? null : body[k]);
        await send(`/api/dates/${editing.id}`, "PATCH", {
          ...body,
          person: clear("person"), relation: clear("relation"), side: clear("side"), year: clear("year"), phone: clear("phone"),
        });
        onSaved(editing.id);
      } else {
        const { event } = await send<{ event: DtEvent }>("/api/dates", "POST", { ...body, giftIdeas: [], gifts: [] });
        onSaved(event.id);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Edit date" : "Add a date"} onClose={onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {DT_TYPES.map((t) => (
            <Chip key={t} on={type === t} onClick={() => setType(t)}>
              {DT_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>

        {needsPerson && (
          <div>
            <label style={labelStyle} htmlFor="dt-person">{type === "anniversary" ? "Whose anniversary" : type === "remembrance" ? "In memory of" : "Whose birthday"}</label>
            <input id="dt-person" autoFocus style={inputStyle} placeholder={type === "anniversary" ? "e.g. Ravi & Priya" : "e.g. Amma"} value={person} onChange={(e) => setPerson(e.target.value)} />
          </div>
        )}

        <div>
          <label style={labelStyle} htmlFor="dt-title">Title</label>
          <input
            id="dt-title"
            autoFocus={!needsPerson}
            style={inputStyle}
            placeholder={type === "festival" ? "e.g. Diwali" : type === "other" ? "e.g. Housewarming" : "Filled in from the name"}
            value={shownTitle}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
          />
        </div>

        <div>
          <span style={labelStyle}>Date</span>
          <div className="flex" style={{ gap: 8 }}>
            <select aria-label="Day" value={day} onChange={(e) => setDay(Number(e.target.value))} style={{ ...inputStyle, width: 84 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }}>
              {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input
              aria-label="Year"
              inputMode="numeric"
              placeholder={recurring ? "Year?" : "Year"}
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              style={{ ...inputStyle, width: 92, borderColor: !recurring && !yearN ? "var(--red)" : "var(--line)" }}
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>
            {recurring
              ? type === "birthday" ? "Add the birth year to see the age they're turning." : type === "anniversary" ? "Add the year to count the anniversary." : "The year is optional."
              : "A one-time date needs its year."}
          </p>
          <label className="flex items-center" style={{ gap: 8, fontSize: 14, marginTop: 8 }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} style={{ width: 17, height: 17 }} />
            Repeats every year
          </label>
        </div>

        {type !== "festival" && (
          <>
            <div>
              <span style={labelStyle}>Relation</span>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {DT_RELATIONS.map((r) => <Chip key={r} on={relation === r} onClick={() => setRelation(relation === r ? undefined : r)}>{DT_RELATION_LABEL[r]}</Chip>)}
              </div>
            </div>
            <div>
              <span style={labelStyle}>Whose side</span>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {DT_SIDES.map((s) => <Chip key={s} on={side === s} onClick={() => setSide(side === s ? undefined : s)}>{DT_SIDE_LABEL[s]}</Chip>)}
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="dt-phone">Phone (for WhatsApp wishes)</label>
              <input id="dt-phone" style={inputStyle} inputMode="tel" placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </>
        )}

        <div>
          <span style={labelStyle}>Remind us</span>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {DT_REMIND_OPTIONS.map((n) => (
              <Chip key={n} on={remindDays.includes(n)} onClick={() => setRemindDays(remindDays.includes(n) ? remindDays.filter((x) => x !== n) : [...remindDays, n])}>
                {remindLabel(n)}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>Reminders arrive through your phone&apos;s calendar — set it up once from “Calendar sync”.</p>
        </div>

        <div>
          <label style={labelStyle} htmlFor="dt-notes">Notes</label>
          <textarea id="dt-notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Likes, sizes, what to remember…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        <button className="btn btn-dark" onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add date"}
        </button>
      </div>
    </Modal>
  );
}
