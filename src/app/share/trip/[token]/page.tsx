import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";
import { dateOfDay, dayLabel, rangeLabel } from "@/lib/trips/logic";
import { dayPhotos, sharedDays, tripByShareToken } from "@/lib/trips/shared";
import { PrintButton } from "@/components/trips/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trip journal", robots: { index: false, follow: false } };

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
  const withPhotos = await Promise.all(days.map(async (d) => ({ day: d, photos: await dayPhotos(d) })));
  const cover = trip.coverPhotoId ?? withPhotos.find((w) => w.photos.length)?.photos[0]?.id;
  const photo = (id: string, w = 520) => `/share/trip/${token}/photo/${id}?w=${w}`;

  return (
    <main className="share-trip" style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .share-trip { padding: 0 !important; }
          .share-day { break-inside: avoid-page; }
          body { background: #fff !important; }
        }
      `}</style>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo(cover, 1600)} alt="" style={{ width: "100%", height: 320, objectFit: "cover", borderRadius: 18, marginBottom: 24 }} />
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

      {withPhotos.length === 0 && <p style={{ color: "var(--faint)", marginTop: 30 }}>The journal for this trip hasn&apos;t been written yet.</p>}

      {withPhotos.map(({ day, photos }) => (
        <section key={day.day} className="share-day" style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--line)" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)" }}>
            Day {day.day}{trip.startDate ? ` · ${dayLabel(dateOfDay(trip.startDate, day.day))}` : ""}
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
          {photos.length > 0 && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginTop: 16 }}>
              {photos.slice(0, 24).map((p) => (
                <a key={p.id} href={photo(p.id, 1600)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo(p.id)} alt={p.name} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, background: "var(--line2)" }} />
                </a>
              ))}
            </div>
          )}
          {photos.length > 24 && <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 8 }}>+{photos.length - 24} more photos</p>}
        </section>
      ))}
      <p className="no-print" style={{ marginTop: 48, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>Shared privately from our family app.</p>
    </main>
  );
}
