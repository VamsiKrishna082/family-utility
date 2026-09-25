"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, ChevronDown, ChevronUp, FolderOpen, FolderPlus, ImageIcon, MapPin, Star, X } from "lucide-react";
import { dateOfDay, dayLabel, mapsLink, todayIST, tripStatus, daysBetween } from "@/lib/trips/logic";
import type { Trip, TripDay } from "@/lib/trips/types";
import type { BrowseResponse, Entry } from "@/lib/types";
import { Lightbox } from "@/components/Lightbox";
import { FolderPicker } from "@/components/trips/FolderPicker";
import { TripMap } from "@/components/trips/TripMap";
import { fetcher, send, Section, smallBtn } from "@/components/trips/shared";

const fieldStyle = { width: "100%", borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 14, background: "var(--card)" } as const;

function DayPhotos({ day, onCover, coverId }: { day: TripDay; onCover: (id: string) => void; coverId?: string }) {
  const { data } = useSWR<BrowseResponse>(day.folderId ? `/api/browse?folder=${day.folderId}` : null, fetcher);
  const [open, setOpen] = useState<number | null>(null);
  const media = (data?.entries ?? []).filter((e): e is Entry => e.kind !== "folder").sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  if (!day.folderId) return null;
  if (!data) return <div className="shimmer" style={{ height: 90, borderRadius: 10 }} />;
  if (!media.length) {
    return (
      <p style={{ fontSize: 13, color: "var(--faint)" }}>
        No photos in <Link href={`/album?folder=${day.folderId}`} style={{ color: "var(--indigo)", fontWeight: 600 }}>{day.folderName || "this folder"}</Link> yet — upload them from the Album.
      </p>
    );
  }
  return (
    <>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
        {media.slice(0, 12).map((m, i) => (
          <div key={m.id} className="group" style={{ position: "relative" }}>
            <button onClick={() => setOpen(i)} style={{ display: "block", width: "100%" }} aria-label={`Open ${m.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/thumb/${m.id}?w=520`} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, background: "var(--line2)" }} />
            </button>
            {m.kind === "photo" && (
              <button
                onClick={() => onCover(m.id)}
                className={coverId === m.id ? "" : "opacity-0 group-hover:opacity-100"}
                title={coverId === m.id ? "Trip cover" : "Make this the trip cover"}
                style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: "rgba(10,8,16,.6)", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity .15s" }}
              >
                <Star size={12} color="#fff" fill={coverId === m.id ? "#fff" : "none"} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="flex items-center justify-between" style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
        <span>{media.length} photo{media.length === 1 ? "" : "s"}{media.length > 12 ? " · showing 12" : ""}</span>
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
  const date = trip.startDate ? dateOfDay(trip.startDate, day.day) : null;
  const planned = trip.plan.filter((p) => p.day === day.day).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  const put = async (body: Omit<Partial<TripDay>, "folderId"> & { folderId?: string | null }, what: string) => {
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
          <span className="block truncate display" style={{ fontSize: 18 }}>{day.title || (date ? dayLabel(date) : `Day ${day.day}`)}</span>
          <span className="block truncate" style={{ fontSize: 12.5, color: "var(--faint)" }}>
            {[date && day.title ? dayLabel(date) : "", day.places.length ? `${day.places.length} place${day.places.length === 1 ? "" : "s"}` : "", day.folderId ? "photos linked" : "", !day.story && !day.title ? "not written yet" : day.story.slice(0, 60)].filter(Boolean).join(" · ")}
          </span>
        </span>
        {open ? <ChevronUp size={18} color="var(--faint)" /> : <ChevronDown size={18} color="var(--faint)" />}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", display: "grid", gap: 14 }}>
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

          <div>
            <p style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Places</p>
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

          {planned.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 }}>Planned for this day</p>
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
              <p className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
                <ImageIcon size={13} /> Photos {day.folderName ? `· ${day.folderName}` : ""}
              </p>
              <span className="flex items-center" style={{ gap: 8 }}>
                <button className="btn btn-plain flex items-center gap-1" style={smallBtn} onClick={() => setPicking(true)}>
                  <FolderOpen size={13} /> {day.folderId ? "Change folder" : "Link a folder"}
                </button>
                {day.folderId && <button style={{ fontSize: 12, color: "var(--faint)" }} onClick={() => put({ folderId: null }, "Folder unlinked")}>Unlink</button>}
              </span>
            </div>
            {day.folderId ? <DayPhotos day={day} onCover={onCover} coverId={trip.coverPhotoId} /> : <p style={{ fontSize: 13, color: "var(--faint)" }}>Link the Album folder with this day&apos;s photos.</p>}
          </div>

          {(saved || error) && <p style={{ fontSize: 12.5, color: error ? "var(--red)" : "#2f6e6b", fontWeight: 600 }}>{error || `✓ ${saved}`}</p>}
        </div>
      )}

      {picking && (
        <FolderPicker
          title={`Photos for day ${day.day}`}
          confirmLabel="Use this folder"
          onClose={() => setPicking(false)}
          onPick={(folderId, name) => put({ folderId, folderName: name }, "Folder linked")}
        />
      )}
    </section>
  );
}

/** The journal: one card per day (story, places, best moment, photos), the trip map, and album folder setup. */
export function JourneyTab({ trip, days, hiddenDays, onChanged, saveTrip }: { trip: Trip; days: TripDay[]; hiddenDays: number[]; onChanged: () => void; saveTrip: (patch: Partial<Trip>) => Promise<void> }) {
  const today = todayIST();
  const status = tripStatus(trip.startDate, trip.endDate, today);
  const todayDay = status === "ongoing" && trip.startDate ? daysBetween(trip.startDate, today) + 1 : null;
  const [openDays, setOpenDays] = useState<Set<number>>(() => new Set(todayDay ? [todayDay] : days.length <= 2 ? days.map((d) => d.day) : [1]));
  const [makingFolders, setMakingFolders] = useState(false);
  const [folderMsg, setFolderMsg] = useState("");
  const missingFolders = days.filter((d) => !d.folderId).length;
  const placesKey = days.map((d) => d.places.join("|")).join("/");

  const toggle = (n: number) => setOpenDays((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
      <div>
        {status === "upcoming" || status === "idea" ? (
          <p className="card mb-4" style={{ padding: 14, fontSize: 13.5, color: "var(--dim)" }}>
            The journal is for once you&apos;re there — each day gets a story, places and photos. Until then, plan it on the Plan tab.
          </p>
        ) : null}
        {days.map((d) => (
          <DayCard
            key={`${d.day}-${d.updatedAt}`}
            trip={trip}
            day={d}
            open={openDays.has(d.day)}
            onToggle={() => toggle(d.day)}
            onSaved={onChanged}
            onCover={(id) => saveTrip({ coverPhotoId: id })}
          />
        ))}
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
        <Section title="Photos">
          <p style={{ fontSize: 13.5, color: "var(--dim)" }}>
            {missingFolders === 0
              ? "Every day has a photo folder linked."
              : `${missingFolders} day${missingFolders === 1 ? " has" : "s have"} no photo folder yet. Link existing Album folders day by day, or create them all at once.`}
          </p>
          {missingFolders > 0 && (
            <button className="btn btn-plain flex items-center gap-1.5 mt-3" onClick={() => setMakingFolders(true)}>
              <FolderPlus size={15} /> Create Album folders
            </button>
          )}
          {trip.albumFolderId && <Link href={`/album?folder=${trip.albumFolderId}`} className="block mt-3" style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>Open the trip&apos;s Album folder</Link>}
          {folderMsg && <p style={{ fontSize: 12.5, color: "#2f6e6b", marginTop: 8, fontWeight: 600 }}>{folderMsg}</p>}
        </Section>
      </div>

      {makingFolders && (
        <FolderPicker
          title={trip.albumFolderId ? "Add day folders" : `Where should “${trip.name}” go?`}
          confirmLabel={trip.albumFolderId ? "Create day folders" : "Create trip folders here"}
          onClose={() => setMakingFolders(false)}
          onPick={async (folderId, _name, isRoot) => {
            const res = await send<{ created: number }>(`/api/trips/${trip.id}/album`, "POST", { parentId: isRoot ? null : folderId });
            setFolderMsg(`Created ${res.created} day folder${res.created === 1 ? "" : "s"} and linked them.`);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
