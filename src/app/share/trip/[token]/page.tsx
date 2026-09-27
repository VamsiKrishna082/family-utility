import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Star, Utensils } from "lucide-react";
import { dateOfDay, dayLabel, journalPhotoList, journalPoints, journalTitle, rangeLabel, wrapUp } from "@/lib/trips/logic";
import { dayPhotos, sharedDays, tripByShareToken } from "@/lib/trips/shared";
import { PrintButton } from "@/components/trips/PrintButton";
import { PlacesMap } from "@/components/trips/TripMap";
import { DestinationArt } from "@/components/trips/DestinationArt";
import { artTheme } from "@/lib/trips/art";

export const dynamic = "force-dynamic";

/** The title is also the file name "Save as PDF" suggests — e.g. "Goa – trip journal (Dec 2026)". */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const trip = await tripByShareToken((await params).token);
  return { title: trip ? journalTitle(trip.name, trip.startDate) : "Trip journal", robots: { index: false, follow: false } };
}

const statStyle = { padding: "12px 14px", borderRadius: 12, background: "var(--line2)", breakInside: "avoid" as const };

/**
 * Read-only trip journal for family and friends: days, stories, places,
 * best moments and photos. Opened by its private link, no sign-in. Print
 * (or "Save as PDF") gives a clean paper version.
 */
export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await tripByShareToken(token);
  if (!trip) notFound();
  const days = await sharedDays(trip);
  // Each day's ♥ favourites first, then the photos chosen for the journal
  // (or all of them if none were chosen), in the order they were taken.
  const withPhotos = await Promise.all(days.map(async (d) => ({ day: d, photos: journalPhotoList(await dayPhotos(d), d.favourites, d.journalPhotos) })));
  const wrap = wrapUp(days, Object.fromEntries(withPhotos.map((w) => [w.day.day, w.photos.length])));
  const photo = (id: string, w = 520) => `/share/trip/${token}/photo/${id}?w=${w}`;
  // Your own uploaded cover, else the ☆ day photo, else the illustrated art if you picked it,
  // else the trip's first photo — and the art when there are no photos at all.
  const coverPhoto = trip.coverPhotoId ?? (trip.coverArt ? undefined : withPhotos.find((w) => w.photos.length)?.photos[0]?.id);
  const coverUrl = trip.coverImage ? `/share/trip/${token}/cover?v=${trip.coverImage.updatedAt}` : coverPhoto ? photo(coverPhoto, 1600) : null;
  const artScene = trip.coverArt && trip.coverArt !== "auto" ? trip.coverArt : artTheme(trip.destination, trip.name);
  const points = journalPoints(days);
  const photoCount = new Map(withPhotos.map((w) => [w.day.day, w.photos.length]));
  const best = wrap.bestDay ? days.find((d) => d.day === wrap.bestDay) : undefined;
  const hasWriting = days.some((d) => d.title || d.story || d.places.length || d.highlight || d.mood || d.rating || d.food?.length);
  const stats = [
    { label: "Days", value: String(wrap.days) },
    wrap.places ? { label: "Places", value: String(wrap.places) } : null,
    wrap.photos ? { label: "Photos", value: String(wrap.photos) } : null,
    wrap.foodSpots ? { label: "Food spots", value: String(wrap.foodSpots) } : null,
    best ? { label: "Best day", value: `Day ${best.day}`, note: best.title || best.highlight || undefined } : null,
  ].filter((x): x is { label: string; value: string; note?: string } => Boolean(x));

  return (
    <main className="share-trip" style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .share-trip { padding: 0 !important; }
          body { background: #fff !important; }
          .share-cover { height: 9cm !important; }
          .share-day, .share-map { break-before: page; border-top: none !important; margin-top: 0 !important; padding-top: 0 !important; }
          .share-map .leaflet-control-zoom { display: none !important; }
          .share-glance-table tr { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .share-day-text { break-inside: avoid; }
          .share-photos { grid-template-columns: repeat(4, 1fr) !important; gap: 6px !important; }
          .share-photos a { break-inside: avoid; }
          .share-photos img { border-radius: 6px !important; }
        }
        @page { margin: 14mm; }
      `}</style>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="share-cover" src={coverUrl} alt="" style={{ width: "100%", height: 320, objectFit: "cover", borderRadius: 18, marginBottom: 24 }} />
      ) : (
        <div className="share-cover" style={{ position: "relative", width: "100%", height: 320, borderRadius: 18, overflow: "hidden", marginBottom: 24 }}>
          <DestinationArt theme={artScene} destination={trip.destination} name={trip.name} />
        </div>
      )}
      <div className="flex items-start justify-between" style={{ gap: 16 }}>
        <div>
          <h1 className="display" style={{ fontSize: 38, lineHeight: 1.1 }}>{trip.name}</h1>
          <p style={{ color: "var(--dim)", fontSize: 15, marginTop: 6 }}>
            {[trip.destination, trip.startDate && trip.endDate ? rangeLabel(trip.startDate, trip.endDate) : null, `${trip.days} day${trip.days === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Trip at a glance */}
      <section className="share-glance" style={{ marginTop: 26 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>Trip at a glance</p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          {stats.map((st) => (
            <div key={st.label} style={statStyle}>
              <p style={{ fontSize: 12, color: "var(--faint)" }}>{st.label}</p>
              <p className="display" style={{ fontSize: 24, lineHeight: 1.2 }}>{st.value}</p>
              {st.note && <p className="truncate" style={{ fontSize: 12, color: "var(--dim)" }}>{st.note}</p>}
            </div>
          ))}
        </div>
        {(trip.travellers.length > 0 || wrap.moods.length > 0) && (
          <p style={{ fontSize: 14, color: "var(--dim)", marginTop: 12 }}>
            {trip.travellers.length > 0 && <>Who went: <b style={{ color: "var(--ink)" }}>{trip.travellers.join(", ")}</b></>}
            {trip.travellers.length > 0 && wrap.moods.length > 0 && " · "}
            {wrap.moods.length > 0 && <>How it felt: <span style={{ letterSpacing: 2 }}>{wrap.moods.join("")}</span></>}
          </p>
        )}
        {hasWriting && (
          <table className="share-glance-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 13.5 }}>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: 700 }}>Day {d.day}</td>
                  <td style={{ padding: "8px 8px", whiteSpace: "nowrap", verticalAlign: "top", color: "var(--faint)" }}>{trip.startDate ? dayLabel(dateOfDay(trip.startDate, d.day)) : ""}</td>
                  <td style={{ padding: "8px 8px", verticalAlign: "top", width: "100%" }}>
                    <span style={{ fontWeight: 600 }}>{d.title || d.highlight || (d.places.length ? d.places.slice(0, 3).join(", ") : <span style={{ color: "var(--faint)", fontWeight: 400 }}>—</span>)}</span>
                    {d.title && d.highlight && <span style={{ display: "block", color: "var(--dim)", fontSize: 12.5 }}>★ {d.highlight}</span>}
                  </td>
                  <td style={{ padding: "8px 0 8px 8px", whiteSpace: "nowrap", verticalAlign: "top", textAlign: "right", color: "var(--dim)" }}>
                    {[d.mood, d.rating ? "★".repeat(d.rating) : "", photoCount.get(d.day) ? `${photoCount.get(d.day)} photos` : ""].filter(Boolean).join("  ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Where we went */}
      {points.length > 0 && (
        <section className="share-map" style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
          <h2 className="display" style={{ fontSize: 26, marginBottom: 12 }}>Where we went</h2>
          <PlacesMap points={points} centre={trip.geo ?? null} height={420} route />
          <div style={{ display: "grid", gap: "6px 18px", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", marginTop: 14, fontSize: 13.5 }}>
            {days.filter((d) => d.places.length).map((d) => (
              <p key={d.day} className="flex items-start" style={{ gap: 8, breakInside: "avoid" }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 11, background: "#2f6e6b", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{d.day}</span>
                <span>{d.places.join(" · ")}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {withPhotos.length === 0 && <p style={{ color: "var(--faint)", marginTop: 30 }}>The journal for this trip hasn&apos;t been written yet.</p>}

      {withPhotos.filter(({ day, photos }) => photos.length || day.title || day.story || day.places.length || day.highlight || day.food?.length).map(({ day, photos }) => (
        <section key={day.day} className="share-day" style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
          <div className="share-day-text">
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)" }}>
            Day {day.day}{trip.startDate ? ` · ${dayLabel(dateOfDay(trip.startDate, day.day))}` : ""}
            {day.mood ? ` · ${day.mood}` : ""}{day.rating ? ` · ${"★".repeat(day.rating)}` : ""}
          </p>
          {day.title && <h2 className="display" style={{ fontSize: 26, marginTop: 4 }}>{day.title}</h2>}
          {day.places.length > 0 && (
            <p className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 13.5, color: "var(--dim)", marginTop: 8 }}>
              <MapPin size={14} /> {day.places.join(" · ")}
            </p>
          )}
          {day.story && <p style={{ fontSize: 16, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>{day.story}</p>}
          {day.highlight && (
            <p className="flex items-start" style={{ gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 12, background: "var(--line2)", fontSize: 14.5 }}>
              <Star size={15} style={{ marginTop: 3, flexShrink: 0 }} /> {day.highlight}
            </p>
          )}
          {(day.food ?? []).length > 0 && (
            <p className="flex flex-wrap items-center" style={{ gap: 6, fontSize: 13.5, color: "var(--dim)", marginTop: 10 }}>
              <Utensils size={14} /> {(day.food ?? []).map((f) => `${f.name}${f.dish ? ` (${f.dish})` : ""}`).join(" · ")}
            </p>
          )}
          </div>
          {photos.length > 0 && (
            <div className="share-photos" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginTop: 16 }}>
              {photos.map((p) => (
                <a key={p.id} href={photo(p.id, 1600)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo(p.id)} alt={p.name} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, background: "var(--line2)" }} />
                </a>
              ))}
            </div>
          )}
        </section>
      ))}
      <p className="no-print" style={{ marginTop: 48, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>Shared privately from our family app.</p>
    </main>
  );
}
