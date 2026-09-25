"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, ChevronDown, ChevronUp, FolderOpen, FolderSearch, Heart, ImageIcon, MapPin, Plus, Star, Trophy, Utensils, X } from "lucide-react";
import { dateOfDay, dayLabel, daysBetween, mapsLink, partOfDay, todayIST, tripStatus } from "@/lib/trips/logic";
import type { FolderSuggestion, FoodNote, Trip, TripDay, TripExpensesResponse, TripWrapUp } from "@/lib/trips/types";
import type { BrowseResponse, Entry } from "@/lib/types";
import { Lightbox } from "@/components/Lightbox";
import { FieldForm, num, str } from "@/components/trips/FieldForm";
import { FolderPicker } from "@/components/trips/FolderPicker";
import { TripMap } from "@/components/trips/TripMap";
import { VoiceNotes } from "@/components/trips/VoiceNotes";
import { Chip, fetcher, Modal, paiseToRupees, send, Section, smallBtn, uid } from "@/components/trips/shared";

const fieldStyle = { width: "100%", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14, background: "var(--card)" } as const;
const labelCaps = { fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const };
const MOODS = ["😍", "😊", "🙂", "😐", "😴", "😣"];
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Stars({ value, onChange, size = 16 }: { value?: number; onChange?: (n: number | null) => void; size?: number }) {
  return (
    <span className="flex items-center" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange?.(value === n ? null : n)} disabled={!onChange} aria-label={`${n} star${n === 1 ? "" : "s"}`} style={{ cursor: onChange ? "pointer" : "default" }}>
          <Star size={size} color="#a8741a" fill={value && n <= value ? "#a8741a" : "none"} />
        </button>
      ))}
    </span>
  );
}

/** A day's photos, grouped morning → night by capture time, with ♥ favourites (max 4) and ☆ trip cover. */
function DayPhotos({ day, coverId, onCover, onFavourites }: { day: TripDay; coverId?: string; onCover: (id: string) => void; onFavourites: (ids: string[]) => void }) {
  const { data } = useSWR<BrowseResponse>(day.folderId ? `/api/browse?folder=${day.folderId}` : null, fetcher);
  const [open, setOpen] = useState<number | null>(null);
  const media = (data?.entries ?? []).filter((e): e is Entry => e.kind !== "folder").sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  const favs = day.favourites ?? [];
  if (!day.folderId) return null;
  if (!data) return <div className="shimmer" style={{ height: 90, borderRadius: 10 }} />;
  if (!media.length) {
    return (
      <p style={{ fontSize: 13, color: "var(--faint)" }}>
        No photos in <Link href={`/album?folder=${day.folderId}`} style={{ color: "var(--indigo)", fontWeight: 600 }}>{day.folderName || "this folder"}</Link> yet — upload them from the Album.
      </p>
    );
  }

  const groups: { part: string; items: { m: Entry; i: number }[] }[] = [];
  media.forEach((m, i) => {
    const part = partOfDay(m.createdTime);
    const last = groups[groups.length - 1];
    if (last && last.part === part) last.items.push({ m, i });
    else groups.push({ part, items: [{ m, i }] });
  });
  const toggleFav = (id: string) => {
    if (favs.includes(id)) onFavourites(favs.filter((x) => x !== id));
    else if (favs.length < 4) onFavourites([...favs, id]);
  };

  return (
    <>
      {groups.map((g, gi) => (
        <div key={`${g.part}-${gi}`} className="mb-2">
          <p style={{ fontSize: 12, color: "var(--faint)", marginBottom: 4 }}>
            {g.part} · {timeOf(g.items[0].m.createdTime)}{g.items.length > 1 ? ` – ${timeOf(g.items[g.items.length - 1].m.createdTime)}` : ""}
          </p>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
            {g.items.slice(0, 12).map(({ m, i }) => {
              const fav = favs.includes(m.id);
              return (
                <div key={m.id} className="group" style={{ position: "relative" }}>
                  <button onClick={() => setOpen(i)} style={{ display: "block", width: "100%" }} aria-label={`Open ${m.name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/thumb/${m.id}?w=520`} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, background: "var(--line2)", outline: fav ? "2px solid #b4533d" : "none", outlineOffset: 1 }} />
                  </button>
                  {m.kind === "photo" && (
                    <span style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                      <button onClick={() => toggleFav(m.id)} className={fav ? "" : "opacity-0 group-hover:opacity-100"} title={fav ? "Remove from favourites" : favs.length >= 4 ? "Up to 4 favourites a day" : "Favourite — shown first on the shared journal"} style={{ width: 24, height: 24, borderRadius: 12, background: "rgba(10,8,16,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Heart size={12} color="#fff" fill={fav ? "#fff" : "none"} />
                      </button>
                      <button onClick={() => onCover(m.id)} className={coverId === m.id ? "" : "opacity-0 group-hover:opacity-100"} title={coverId === m.id ? "Trip cover" : "Make this the trip cover"} style={{ width: 24, height: 24, borderRadius: 12, background: "rgba(10,8,16,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Star size={12} color="#fff" fill={coverId === m.id ? "#fff" : "none"} />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {g.items.length > 12 && <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>+{g.items.length - 12} more in the {g.part.toLowerCase()}</p>}
        </div>
      ))}
      <p className="flex items-center justify-between" style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
        <span>{media.length} photo{media.length === 1 ? "" : "s"} · ♥ {favs.length}/4 favourites</span>
        <Link href={`/album?folder=${day.folderId}`} style={{ color: "var(--indigo)", fontWeight: 600 }}>Open in Album</Link>
      </p>
      {open !== null && <Lightbox items={media} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function DayCard({ trip, day, open, onToggle, onSaved, onCover }: { trip: Trip; day: TripDay; open: boolean; onToggle: () => void; onSaved: () => void; onCover: (id: string) => void }) {
  const [title, setTitle] = useState(day.title);
  const [story, setStory] = useState(day.story);
  const [highlight, setHighlight] = useState(day.highlight);
  const [place, setPlace] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [foodForm, setFoodForm] = useState<{ id?: string } | null>(null);
  const date = trip.startDate ? dateOfDay(trip.startDate, day.day) : null;
  const planned = trip.plan.filter((p) => p.day === day.day).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const others = trip.travellers.filter((t) => t.toLowerCase() !== "us");
  const food = day.food ?? [];
  const editingFood = foodForm?.id ? food.find((f) => f.id === foodForm.id) : undefined;

  const put = async (body: Record<string, unknown>, what: string) => {
    setError("");
    try {
      await send(`/api/trips/${trip.id}/days/${day.day}`, "PUT", body);
      setSaved(what);
      setTimeout(() => setSaved(null), 1800);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const addPlace = () => {
    const p = place.trim();
    if (!p || day.places.includes(p)) return setPlace("");
    setPlace("");
    put({ places: [...day.places, p] }, "Place added");
  };

  return (
    <section className="card mb-4" style={{ overflow: "hidden" }}>
      <button onClick={onToggle} className="flex items-center gap-3 w-full text-left" style={{ padding: "14px 18px" }} aria-expanded={open}>
        <span className="flex flex-col items-center justify-center shrink-0" style={{ width: 46, height: 46, borderRadius: 12, background: "#e5efee", color: "#2f6e6b" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>Day</span>
          <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{day.day}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate display" style={{ fontSize: 18 }}>{day.title || (date ? dayLabel(date) : `Day ${day.day}`)}</span>
            {day.mood && <span style={{ fontSize: 16 }}>{day.mood}</span>}
            {day.rating ? <Stars value={day.rating} size={12} /> : null}
          </span>
          <span className="block truncate" style={{ fontSize: 12.5, color: "var(--faint)" }}>
            {[date && day.title ? dayLabel(date) : "", day.places.length ? `${day.places.length} place${day.places.length === 1 ? "" : "s"}` : "", day.folderId ? "photos linked" : "", !day.story && !day.title ? "not written yet" : day.story.slice(0, 60)].filter(Boolean).join(" · ")}
          </span>
        </span>
        {open ? <ChevronUp size={18} color="var(--faint)" /> : <ChevronDown size={18} color="var(--faint)" />}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", display: "grid", gap: 14 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
            <span className="flex items-center" style={{ gap: 2 }}>
              {MOODS.map((m) => (
                <button key={m} onClick={() => put({ mood: day.mood === m ? null : m }, "Mood saved")} aria-pressed={day.mood === m} aria-label={`Mood ${m}`}
                  style={{ fontSize: 20, padding: "2px 4px", borderRadius: 8, background: day.mood === m ? "var(--line2)" : "transparent", opacity: day.mood && day.mood !== m ? 0.45 : 1 }}>
                  {m}
                </button>
              ))}
            </span>
            <span className="flex items-center" style={{ gap: 6, fontSize: 12.5, color: "var(--faint)" }}>
              Day rating <Stars value={day.rating} onChange={(n) => put({ rating: n }, "Rating saved")} />
            </span>
          </div>

          <input style={fieldStyle} placeholder="Give the day a title, e.g. Waterfalls and a long lunch" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== day.title && put({ title }, "Title saved")} aria-label="Day title" />

          <textarea
            rows={7}
            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6, fontSize: 15 }}
            placeholder="What did we do today? Where did we go, what did we eat, what made us laugh…"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            onBlur={() => story !== day.story && put({ story }, "Story saved")}
            aria-label="Story of the day"
          />

          <VoiceNotes tripId={trip.id} day={day.day} notes={day.voice ?? []} onChanged={onSaved} />

          <div>
            <p style={{ ...labelCaps, marginBottom: 6 }}>Places</p>
            <div className="flex flex-wrap mb-2" style={{ gap: 6 }}>
              {day.places.map((p) => (
                <span key={p} className="flex items-center" style={{ gap: 6, padding: "5px 10px", borderRadius: 999, background: "var(--line2)", fontSize: 13 }}>
                  <a href={mapsLink(p, trip.destination)} target="_blank" rel="noreferrer" className="flex items-center" style={{ gap: 4 }}><MapPin size={12} /> {p}</a>
                  <button onClick={() => put({ places: day.places.filter((x) => x !== p) }, "Place removed")} aria-label={`Remove ${p}`}><X size={12} color="var(--faint)" /></button>
                </span>
              ))}
            </div>
            <input style={fieldStyle} placeholder="Add a place and press Enter" value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlace()} onBlur={addPlace} aria-label="Add a place" />
          </div>

          <input style={fieldStyle} placeholder="⭐ Best moment of the day" value={highlight} onChange={(e) => setHighlight(e.target.value)} onBlur={() => highlight !== day.highlight && put({ highlight }, "Saved")} aria-label="Best moment" />

          {others.length > 0 && (
            <div>
              <p style={{ ...labelCaps, marginBottom: 6 }}>Who was there</p>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {trip.travellers.map((t) => {
                  const on = (day.who ?? []).includes(t);
                  return <Chip key={t} on={on} onClick={() => put({ who: on ? (day.who ?? []).filter((x) => x !== t) : [...(day.who ?? []), t] }, "Saved")}>{t}</Chip>;
                })}
              </div>
              <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>Leave empty if everyone was there.</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="flex items-center" style={{ ...labelCaps, gap: 5 }}><Utensils size={12} /> Food</p>
              <button className="flex items-center" style={{ gap: 3, fontSize: 12.5, color: "var(--indigo)", fontWeight: 600 }} onClick={() => setFoodForm({})}><Plus size={12} /> Add</button>
            </div>
            {!food.length && <p style={{ fontSize: 12.5, color: "var(--faint)" }}>Restaurants and dishes worth remembering.</p>}
            {food.map((f) => (
              <button key={f.id} onClick={() => setFoodForm({ id: f.id })} className="flex items-center gap-2 w-full text-left py-1.5" style={{ borderTop: "1px solid var(--line2)", fontSize: 14 }}>
                <span className="flex-1 min-w-0 truncate"><strong>{f.name}</strong>{f.dish ? <span style={{ color: "var(--dim)" }}> · {f.dish}</span> : null}</span>
                {f.goBack && <span style={{ fontSize: 11, fontWeight: 700, color: "#2f6e6b", background: "#e5efee", borderRadius: 999, padding: "2px 8px" }}>Go back</span>}
                {f.rating ? <Stars value={f.rating} size={12} /> : null}
              </button>
            ))}
          </div>

          {planned.length > 0 && (
            <div>
              <p style={{ ...labelCaps, marginBottom: 4 }}>Planned for this day</p>
              {planned.map((p) => (
                <p key={p.id} className="flex items-center gap-2 py-1" style={{ fontSize: 14 }}>
                  <span className="flex items-center justify-center" style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${p.status === "done" ? "#2f6e6b" : "var(--faint)"}`, background: p.status === "done" ? "#2f6e6b" : "transparent" }}>
                    {p.status === "done" && <Check size={11} color="#fff" />}
                  </span>
                  <span style={{ color: p.status === "done" ? "var(--faint)" : undefined }}>{p.time ? `${p.time} · ` : ""}{p.title}</span>
                </p>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2" style={{ gap: 8 }}>
              <p className="flex items-center gap-1.5" style={labelCaps}><ImageIcon size={13} /> Photos {day.folderName ? `· ${day.folderName}` : ""}</p>
              <span className="flex items-center" style={{ gap: 8 }}>
                <button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setPicking(true)}>
                  <FolderOpen size={13} /> {day.folderId ? "Change folder" : "Link a folder"}
                </button>
                {day.folderId && <button style={{ fontSize: 12, color: "var(--faint)" }} onClick={() => put({ folderId: null }, "Folder unlinked")}>Unlink</button>}
              </span>
            </div>
            {day.folderId ? (
              <DayPhotos day={day} coverId={trip.coverPhotoId} onCover={onCover} onFavourites={(ids) => put({ favourites: ids }, "Favourites saved")} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Link the Album folder with this day&apos;s photos — or use “Find photo folders” above.</p>
            )}
          </div>

          {(saved || error) && <p style={{ fontSize: 12.5, color: error ? "var(--red)" : "#2f6e6b", fontWeight: 600 }}>{error || `✓ ${saved}`}</p>}
        </div>
      )}

      {picking && (
        <FolderPicker title={`Photos for day ${day.day}`} confirmLabel="Use this folder" onClose={() => setPicking(false)} onPick={(folderId, name) => put({ folderId, folderName: name }, "Folder linked")} />
      )}
      {foodForm && (
        <FieldForm
          title={editingFood ? "Edit food note" : "Food worth remembering"}
          fields={[
            { key: "name", label: "Place", type: "text", required: true, placeholder: "e.g. Vidyarthi Bhavan" },
            { key: "dish", label: "What we had", type: "text", placeholder: "e.g. Masala dosa, filter coffee" },
            { key: "rating", label: "Rating", type: "select", options: [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) })) },
            { key: "goBack", label: "Want to go back?", type: "select", options: [{ value: "yes", label: "Yes, next time!" }] },
          ]}
          initial={editingFood ? { name: editingFood.name, ...(editingFood.dish ? { dish: editingFood.dish } : {}), ...(editingFood.rating ? { rating: String(editingFood.rating) } : {}), ...(editingFood.goBack ? { goBack: "yes" } : {}) } : undefined}
          onClose={() => setFoodForm(null)}
          onSubmit={(v) => {
            const note: FoodNote = { id: editingFood?.id ?? uid(), name: v.name, dish: str(v.dish), rating: num(v.rating), goBack: v.goBack === "yes" || undefined };
            const clean = JSON.parse(JSON.stringify(note)) as FoodNote;
            return put({ food: editingFood ? food.map((f) => (f.id === clean.id ? clean : f)) : [...food, clean] }, "Food saved");
          }}
          onDelete={editingFood ? () => put({ food: food.filter((f) => f.id !== editingFood.id) }, "Removed") : undefined}
        />
      )}
    </section>
  );
}

function WrapUp({ trip, onOpenDay }: { trip: Trip; onOpenDay: (n: number) => void }) {
  const { data } = useSWR<TripWrapUp>(`/api/trips/${trip.id}/wrap`, fetcher);
  const { data: exp } = useSWR<TripExpensesResponse>(`/api/trips/${trip.id}/expenses`, fetcher);
  if (!data) return null;
  const spent = exp ? exp.items.reduce((s, e) => s + e.amountPaise, 0) - exp.refunds.reduce((s, e) => s + e.amountPaise, 0) : null;
  const stat = (label: string, value: string | number) => (
    <div><p style={{ fontSize: 11.5, color: "var(--faint)" }}>{label}</p><p className="display" style={{ fontSize: 22 }}>{value}</p></div>
  );
  return (
    <section className="card mb-5" style={{ padding: 18, background: "linear-gradient(135deg, #f7f3ea, #eef4f2)" }}>
      <p className="flex items-center display" style={{ gap: 8, fontSize: 19 }}><Trophy size={17} color="#a8741a" /> Trip wrap-up</p>
      <div className="mt-3" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
        {stat("Days written", `${data.daysWritten}/${data.days}`)}
        {stat("Places", data.places)}
        {stat("Photos", data.photos)}
        {stat("Food spots", data.foodSpots)}
        {spent !== null && spent > 0 && stat("Spent", paiseToRupees(spent))}
      </div>
      {data.bestDay && (
        <button onClick={() => onOpenDay(data.bestDay!)} style={{ fontSize: 13.5, marginTop: 12, color: "var(--indigo)", fontWeight: 600 }}>
          Best day: Day {data.bestDay} →
        </button>
      )}
      {data.moods.length > 0 && <p style={{ fontSize: 20, marginTop: 8, letterSpacing: 2 }}>{data.moods.join("")}</p>}
      {data.highlights.length > 0 && (
        <div className="mt-2">
          {data.highlights.slice(0, 5).map((h) => (
            <p key={h.day} style={{ fontSize: 13.5, marginTop: 4 }}><span style={{ color: "var(--faint)" }}>Day {h.day} · </span>{h.text}</p>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>The shared journal shows this too — without the money.</p>
    </section>
  );
}

function FolderSuggestions({ trip, onClose, onLinked }: { trip: Trip; onClose: () => void; onLinked: () => void }) {
  const { data, isLoading } = useSWR<{ items: FolderSuggestion[]; scanned: number }>(`/api/trips/${trip.id}/folder-suggestions`, fetcher, { revalidateOnFocus: false });
  const [linked, setLinked] = useState<Set<number>>(new Set());
  const link = async (s: FolderSuggestion) => {
    await send(`/api/trips/${trip.id}/days/${s.day}`, "PUT", { folderId: s.folderId, folderName: s.folderName });
    setLinked((x) => new Set(x).add(s.day));
    onLinked();
  };
  const byDay = new Map<number, FolderSuggestion[]>();
  for (const s of data?.items ?? []) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
  return (
    <Modal title="Find photo folders" onClose={onClose} wide>
      {isLoading && <p style={{ fontSize: 13.5, color: "var(--faint)" }}>Looking through the Album for photos taken on each day…</p>}
      {data && byDay.size === 0 && (
        <p style={{ fontSize: 13.5, color: "var(--faint)" }}>No Album folders with photos from these dates (checked {data.scanned} folders). Upload the trip photos to the Album, then try again.</p>
      )}
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="mb-3">
          <p style={{ fontSize: 13, fontWeight: 700 }}>Day {day} · {dayLabel(list[0].date)}</p>
          {list.map((s) => (
            <div key={s.folderId} className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--line2)" }}>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 14 }}>{s.folderName}</span>
                <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>{s.path} · {s.photosOnDay} of {s.photosTotal} photos from that day</span>
              </span>
              <button className="btn btn-plain" style={smallBtn} disabled={linked.has(day)} onClick={() => link(s)}>{linked.has(day) ? "Linked" : "Link"}</button>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

/** The journal: wrap-up, one card per day (mood, story, voice, places, food, photos), the map. */
export function JourneyTab({ trip, days, hiddenDays, onChanged, saveTrip }: { trip: Trip; days: TripDay[]; hiddenDays: number[]; onChanged: () => void; saveTrip: (patch: Partial<Trip>) => Promise<void> }) {
  const today = todayIST();
  const status = tripStatus(trip.startDate, trip.endDate, today);
  const todayDay = status === "ongoing" && trip.startDate ? daysBetween(trip.startDate, today) + 1 : null;
  const [openDays, setOpenDays] = useState<Set<number>>(() => new Set(todayDay ? [todayDay] : days.length <= 2 ? days.map((d) => d.day) : [1]));
  const [person, setPerson] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const placesKey = days.map((d) => d.places.join("|")).join("/");
  const others = trip.travellers.filter((t) => t.toLowerCase() !== "us");
  const shown = person ? days.filter((d) => !d.who?.length || d.who.includes(person)) : days;
  const unlinked = days.filter((d) => !d.folderId).length;

  const toggle = (n: number) => setOpenDays((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const openDay = (n: number) => { setOpenDays((s) => new Set(s).add(n)); setTimeout(() => document.getElementById(`trip-day-${n}`)?.scrollIntoView({ behavior: "smooth" }), 50); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
      <div>
        {(status === "completed" || status === "ongoing") && <WrapUp trip={trip} onOpenDay={openDay} />}
        {status === "upcoming" || status === "idea" ? (
          <p className="card mb-4" style={{ padding: 14, fontSize: 13.5, color: "var(--dim)" }}>
            The journal is for once you&apos;re there — each day gets a story, places and photos. Until then, plan it on the Plan tab.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center mb-4" style={{ gap: 8 }}>
          {unlinked > 0 && trip.startDate && (
            <button className="btn btn-plain flex items-center gap-1.5" onClick={() => setSuggesting(true)}><FolderSearch size={14} /> Find photo folders</button>
          )}
          {others.length > 0 && (
            <span className="flex flex-wrap items-center" style={{ gap: 6, marginLeft: "auto" }}>
              <span style={{ fontSize: 12.5, color: "var(--faint)" }}>Show days with</span>
              <Chip on={person === null} onClick={() => setPerson(null)}>Everyone</Chip>
              {others.map((p) => <Chip key={p} on={person === p} onClick={() => setPerson(person === p ? null : p)}>{p}</Chip>)}
            </span>
          )}
        </div>
        {shown.map((d) => (
          <div key={`${d.day}-${d.updatedAt}`} id={`trip-day-${d.day}`}>
            <DayCard trip={trip} day={d} open={openDays.has(d.day)} onToggle={() => toggle(d.day)} onSaved={onChanged} onCover={(id) => saveTrip({ coverPhotoId: id })} />
          </div>
        ))}
        {person && shown.length === 0 && <p style={{ fontSize: 13.5, color: "var(--faint)" }}>No days tagged with {person} yet.</p>}
        {hiddenDays.length > 0 && (
          <p style={{ fontSize: 12.5, color: "var(--faint)" }}>
            Day {hiddenDays.join(", ")} {hiddenDays.length === 1 ? "is" : "are"} hidden because the trip was shortened — make it longer again to see {hiddenDays.length === 1 ? "it" : "them"}.
          </p>
        )}
      </div>

      <div>
        <Section title="Map">
          <TripMap tripId={trip.id} refreshKey={placesKey} />
        </Section>
      </div>

      {suggesting && <FolderSuggestions trip={trip} onClose={() => setSuggesting(false)} onLinked={onChanged} />}
    </div>
  );
}
