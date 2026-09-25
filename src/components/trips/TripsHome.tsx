"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ChevronLeft, Lightbulb, MapPin, Plus } from "lucide-react";
import { rangeLabel, todayIST, tripStatus, tripWhen } from "@/lib/trips/logic";
import type { TripSummary, TripsResponse } from "@/lib/trips/types";
import { TripForm } from "@/components/trips/TripForm";
import { Cover, fetcher, paiseToRupees, StatusPill } from "@/components/trips/shared";

function TripCard({ t, today }: { t: TripSummary; today: string }) {
  const status = tripStatus(t.startDate, t.endDate, today);
  return (
    <Link href={`/trips/${t.id}`} className="card block" style={{ padding: 10 }}>
      <Cover photoId={t.coverPhotoId} height={150} radius={12}>
        <span style={{ position: "absolute", top: 10, left: 10 }}><StatusPill status={status} /></span>
      </Cover>
      <div style={{ padding: "12px 6px 4px" }}>
        <p className="display truncate" style={{ fontSize: 19 }}>{t.name}</p>
        <p className="flex items-center truncate" style={{ gap: 5, fontSize: 13, color: "var(--dim)", marginTop: 3 }}>
          {t.destination && <><MapPin size={13} /> {t.destination} · </>}
          {t.startDate && t.endDate ? rangeLabel(t.startDate, t.endDate) : `${t.days} day${t.days === 1 ? "" : "s"}, someday`}
        </p>
        <div className="flex items-center justify-between" style={{ marginTop: 10, fontSize: 12.5 }}>
          <span style={{ color: status === "ongoing" ? "#b4533d" : "var(--faint)", fontWeight: 600 }}>{tripWhen(t.startDate, t.endDate, t.days, today)}</span>
          {t.spentPaise > 0 && <span style={{ color: "var(--dim)", fontWeight: 600 }}>{paiseToRupees(t.spentPaise)} spent</span>}
        </div>
      </div>
    </Link>
  );
}

function Grid({ title, trips, today }: { title: string; trips: TripSummary[]; today: string }) {
  if (!trips.length) return null;
  return (
    <section className="mb-8">
      <p style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>{title}</p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {trips.map((t) => <TripCard key={t.id} t={t} today={today} />)}
      </div>
    </section>
  );
}

/** All trips: on now, coming up, ideas, and past trips by year — with this year's numbers on top. */
export function TripsHome() {
  const router = useRouter();
  const today = todayIST();
  const { data, error, isLoading, mutate } = useSWR<TripsResponse>("/api/trips", fetcher);
  const [creating, setCreating] = useState(false);
  const trips = data?.items ?? [];

  const groups = useMemo(() => {
    const by = { ongoing: [] as TripSummary[], upcoming: [] as TripSummary[], idea: [] as TripSummary[], completed: [] as TripSummary[] };
    for (const t of trips) by[tripStatus(t.startDate, t.endDate, today)].push(t);
    by.upcoming.sort((a, b) => a.startDate!.localeCompare(b.startDate!));
    by.idea.sort((a, b) => b.createdAt - a.createdAt);
    const years = new Map<string, TripSummary[]>();
    for (const t of by.completed) years.set(t.startDate!.slice(0, 4), [...(years.get(t.startDate!.slice(0, 4)) ?? []), t]);
    return { ...by, years: [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
  }, [trips, today]);

  const year = today.slice(0, 4);
  const thisYear = trips.filter((t) => t.startDate?.startsWith(year) && tripStatus(t.startDate, t.endDate, today) !== "upcoming");
  const daysAway = thisYear.reduce((s, t) => s + t.days, 0);
  const spentThisYear = thisYear.reduce((s, t) => s + t.spentPaise, 0);

  return (
    <div>
      <div className="flex items-start gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <Link href="/" className="flex items-center justify-center shrink-0 card" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="Home">
          <ChevronLeft size={19} />
        </Link>
        <div className="flex-1" style={{ minWidth: 180 }}>
          <h1 className="display" style={{ fontSize: 30 }}>Trips</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 4 }}>Plan them, live them, remember them.</p>
        </div>
        <button className="btn btn-dark flex items-center gap-1.5" style={{ marginLeft: "auto" }} onClick={() => setCreating(true)}>
          <Plus size={15} /> New trip
        </button>
      </div>

      {error && <div className="card mb-5" style={{ padding: 16, color: "var(--red)", fontSize: 14 }}>{error.message}</div>}
      {isLoading && !data && <p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}

      {data && trips.length === 0 ? (
        <div className="card text-center" style={{ padding: "44px 20px" }}>
          <p className="display" style={{ fontSize: 22 }}>Where to next?</p>
          <p style={{ color: "var(--faint)", fontSize: 14, marginTop: 8, maxWidth: 460, marginInline: "auto" }}>
            Start with an idea, plan the days, stays and bookings, then write each day&apos;s story with its photos — and see everything you spent, across months.
          </p>
          <div className="flex justify-center flex-wrap mt-5" style={{ gap: 8 }}>
            <button className="btn btn-dark flex items-center gap-1.5" onClick={() => setCreating(true)}><Plus size={15} /> Plan a trip</button>
          </div>
        </div>
      ) : (
        <>
          {thisYear.length > 0 && (
            <div className="mb-8" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {[
                [`Trips in ${year}`, String(thisYear.length)],
                ["Days away", String(daysAway)],
                ["Spent on trips", paiseToRupees(spentThisYear)],
              ].map(([label, value]) => (
                <div key={label} className="card" style={{ padding: 16 }}>
                  <p style={{ fontSize: 12.5, color: "var(--faint)" }}>{label}</p>
                  <p className="display" style={{ fontSize: 24, marginTop: 4 }}>{value}</p>
                </div>
              ))}
            </div>
          )}
          <Grid title="On the trip now" trips={groups.ongoing} today={today} />
          <Grid title="Coming up" trips={groups.upcoming} today={today} />
          {groups.idea.length > 0 && (
            <section className="mb-8">
              <p className="flex items-center" style={{ gap: 6, fontSize: 12.5, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>
                <Lightbulb size={13} /> Ideas & someday
              </p>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
                {groups.idea.map((t) => <TripCard key={t.id} t={t} today={today} />)}
              </div>
            </section>
          )}
          {groups.years.map(([y, list]) => <Grid key={y} title={`Memories · ${y}`} trips={list} today={today} />)}
        </>
      )}

      {creating && <TripForm onClose={() => setCreating(false)} onSaved={(id) => { mutate(); router.push(`/trips/${id}`); }} />}
    </div>
  );
}
