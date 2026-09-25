"use client";

import Link from "next/link";
import useSWR from "swr";
import { MapPin } from "lucide-react";
import { daysBetween, todayIST, tripStatus } from "@/lib/trips/logic";
import type { TripsResponse } from "@/lib/trips/types";
import { Cover, fetcher } from "@/components/trips/shared";

/**
 * Home-page memories: past trips that started within a few days of today's
 * date in an earlier year ("2 years ago this week"). Hidden when there are none.
 */
export function TripMemories() {
  const { data } = useSWR<TripsResponse>("/api/trips", fetcher);
  const today = todayIST();
  const thisYear = Number(today.slice(0, 4));
  const memories = (data?.items ?? [])
    .filter((t) => t.startDate && tripStatus(t.startDate, t.endDate, today) === "completed")
    .map((t) => {
      const years = thisYear - Number(t.startDate!.slice(0, 4));
      const anniversary = `${thisYear}${t.startDate!.slice(4)}`;
      return { t, years, off: Math.abs(daysBetween(today, anniversary)) };
    })
    .filter((m) => m.years >= 1 && m.off <= 4)
    .sort((a, b) => a.off - b.off)
    .slice(0, 3);
  if (!memories.length) return null;

  return (
    <section className="mt-9">
      <p className="display mb-3" style={{ fontSize: 19 }}>This week, years ago</p>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {memories.map(({ t, years }) => (
          <Link key={t.id} href={`/trips/${t.id}`} className="card block" style={{ padding: 8 }}>
            <Cover photoId={t.coverPhotoId} height={120} radius={10} />
            <div style={{ padding: "10px 6px 4px" }}>
              <p className="display truncate" style={{ fontSize: 17 }}>{t.name}</p>
              <p className="flex items-center truncate" style={{ gap: 5, fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>
                {years} year{years === 1 ? "" : "s"} ago{t.destination && <> · <MapPin size={12} /> {t.destination}</>}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
