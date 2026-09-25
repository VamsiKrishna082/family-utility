"use client";

import { useState } from "react";
import { CalendarPlus, MessageCircle, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import {
  countdownLabel, googleCalendarLink, greeting, isMilestone, MONTHS_LONG, todayIST, weekday, whatsappLink, yearsLabel,
} from "@/lib/dates/logic";
import { DT_RELATION_LABEL, DT_SIDE_LABEL, DT_TYPE_LABEL, type DtEvent } from "@/lib/dates/types";
import { inputStyle, labelStyle, Modal, rupees, send, TYPE_COLOR, TypeIcon, type Row } from "@/components/dates/shared";

/** One date: when it next falls, quick wishes, notes, gift ideas and what you've given before. */
export function DateDetail({ row, onClose, onEdit, onChanged }: { row: Row; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const { ev, occ } = row;
  const today = todayIST();
  const [ideas, setIdeas] = useState(ev.giftIdeas);
  const [gifts, setGifts] = useState(ev.gifts);
  const [idea, setIdea] = useState("");
  const [giftWhat, setGiftWhat] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftYear, setGiftYear] = useState(String(occ.daysAway <= 0 ? occ.date.y : today.y));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const years = occ.years;
  const label = yearsLabel(ev.type, years);
  const milestone = isMilestone(ev.type, years);
  const c = TYPE_COLOR[ev.type];

  const patch = async (body: Partial<DtEvent>) => {
    setError("");
    try {
      await send(`/api/dates/${ev.id}`, "PATCH", body);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const addIdea = () => {
    const v = idea.trim();
    if (!v) return;
    const next = [...ideas, v];
    setIdeas(next);
    setIdea("");
    patch({ giftIdeas: next });
  };
  const removeIdea = (i: number) => {
    const next = ideas.filter((_, j) => j !== i);
    setIdeas(next);
    patch({ giftIdeas: next });
  };
  const addGift = () => {
    const what = giftWhat.trim();
    const y = Number(giftYear);
    if (!what || !(y >= 1900)) return;
    const amount = Number(giftAmount);
    const next = [...gifts, { year: y, what, ...(amount > 0 ? { amountRupees: amount } : {}) }];
    setGifts(next);
    setGiftWhat("");
    setGiftAmount("");
    patch({ gifts: next });
  };
  const removeGift = (i: number) => {
    const next = gifts.filter((_, j) => j !== i);
    setGifts(next);
    patch({ gifts: next });
  };

  const del = async () => {
    await send(`/api/dates/${ev.id}`, "DELETE");
    onChanged();
    onClose();
  };

  const sortedGifts = gifts.map((g, i) => ({ g, i })).sort((a, b) => b.g.year - a.g.year);
  const totalGiven = gifts.reduce((s, g) => s + (g.amountRupees ?? 0), 0);
  const originally = ev.year ? `${ev.day} ${MONTHS_LONG[ev.month - 1]} ${ev.year}` : `${ev.day} ${MONTHS_LONG[ev.month - 1]}`;

  return (
    <Modal title={ev.title} onClose={onClose} wide>
      <div style={{ display: "grid", gap: 18 }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <TypeIcon type={ev.type} size={48} />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 13, color: c.ink, fontWeight: 700 }}>
              {DT_TYPE_LABEL[ev.type]}
              {ev.relation && ` · ${DT_RELATION_LABEL[ev.relation]}`}
              {ev.side && ` · ${DT_SIDE_LABEL[ev.side]}`}
            </p>
            <p className="display" style={{ fontSize: 22, marginTop: 2 }}>
              {occ.past ? "Was" : countdownLabel(occ.daysAway)} · {weekday(occ.date, "long")}, {occ.date.d} {MONTHS_LONG[occ.date.m - 1]}
              {occ.date.y !== today.y && ` ${occ.date.y}`}
            </p>
            <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 2 }}>
              {label && <strong style={{ color: "var(--ink)" }}>{label[0].toUpperCase() + label.slice(1)} · </strong>}
              {ev.recurring ? `Every year · since ${originally}` : `One-time · ${originally}`}
              {milestone && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: c.tint, color: c.ink, fontSize: 11, fontWeight: 700 }}>MILESTONE</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <a className="btn btn-dark flex items-center gap-1.5" href={whatsappLink(ev.phone, greeting(ev, years))} target="_blank" rel="noreferrer">
            <MessageCircle size={15} /> {ev.type === "remembrance" ? "Send a message" : "Send wishes"}
          </a>
          {ev.phone && (
            <a className="btn btn-plain flex items-center gap-1.5" href={`tel:${ev.phone.replace(/[^\d+]/g, "")}`}><Phone size={15} /> Call</a>
          )}
          <a className="btn btn-plain flex items-center gap-1.5" href={googleCalendarLink(ev, today)} target="_blank" rel="noreferrer"><CalendarPlus size={15} /> Google Calendar</a>
          <button className="btn btn-plain flex items-center gap-1.5" onClick={onEdit}><Pencil size={14} /> Edit</button>
        </div>

        {ev.notes && (
          <div>
            <span style={labelStyle}>Notes</span>
            <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{ev.notes}</p>
          </div>
        )}

        {ev.type !== "remembrance" && ev.type !== "festival" && (
          <div>
            <span style={labelStyle}>Gift ideas</span>
            {ideas.length > 0 && (
              <div className="flex flex-wrap mb-2" style={{ gap: 6 }}>
                {ideas.map((t, i) => (
                  <span key={`${t}-${i}`} className="flex items-center" style={{ gap: 6, padding: "6px 10px", borderRadius: 999, background: "var(--line2)", fontSize: 13 }}>
                    {t}
                    <button onClick={() => removeIdea(i)} aria-label={`Remove ${t}`}><X size={12} color="var(--faint)" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex" style={{ gap: 8 }}>
              <input style={inputStyle} placeholder="e.g. Silk saree, Kindle" value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addIdea()} aria-label="New gift idea" />
              <button className="btn btn-plain" onClick={addIdea} disabled={!idea.trim()} aria-label="Add gift idea"><Plus size={15} /></button>
            </div>
          </div>
        )}

        {ev.type !== "remembrance" && ev.type !== "festival" && (
          <div>
            <span style={labelStyle}>Gifts given{totalGiven > 0 ? ` · ${rupees(totalGiven)} in total` : ""}</span>
            {sortedGifts.map(({ g, i }) => (
              <div key={i} className="flex items-center" style={{ gap: 10, padding: "8px 0", borderTop: "1px solid var(--line2)", fontSize: 14 }}>
                <span style={{ color: "var(--faint)", width: 44 }}>{g.year}</span>
                <span className="flex-1">{g.what}</span>
                {g.amountRupees ? <span style={{ fontWeight: 600 }}>{rupees(g.amountRupees)}</span> : null}
                <button onClick={() => removeGift(i)} aria-label="Remove gift"><Trash2 size={14} color="var(--faint)" /></button>
              </div>
            ))}
            <div className="flex mt-2" style={{ gap: 8 }}>
              <input style={{ ...inputStyle, width: 76 }} inputMode="numeric" value={giftYear} onChange={(e) => setGiftYear(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Year given" />
              <input style={inputStyle} placeholder="What you gave" value={giftWhat} onChange={(e) => setGiftWhat(e.target.value)} aria-label="Gift" />
              <input style={{ ...inputStyle, width: 100 }} inputMode="decimal" placeholder="₹" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount" />
              <button className="btn btn-plain" onClick={addGift} disabled={!giftWhat.trim()} aria-label="Add gift"><Plus size={15} /></button>
            </div>
          </div>
        )}

        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

        <div className="flex justify-end" style={{ borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
          {confirmDelete ? (
            <div className="flex items-center" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--dim)" }}>Delete this date?</span>
              <button className="btn btn-plain" onClick={() => setConfirmDelete(false)}>Keep</button>
              <button className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={del}>Delete</button>
            </div>
          ) : (
            <button className="flex items-center" style={{ gap: 6, fontSize: 13, color: "var(--faint)" }} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
