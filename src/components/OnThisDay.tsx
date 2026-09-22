"use client";

import { useState } from "react";
import useSWR from "swr";
import { CalendarClock } from "lucide-react";
import type { FavoritesResponse } from "@/lib/types";
import { Thumb } from "@/components/Thumb";
import { Lightbox } from "@/components/Lightbox";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load");
  return r.json();
};

function yearsAgo(iso: string): string {
  const years = new Date().getFullYear() - new Date(iso).getFullYear();
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/**
 * Photos taken today's month/day in a past year. Silent when there aren't
 * any — a mostly-empty dashboard widget is worse than no widget, and most
 * days of the year won't have a match for a two-person library.
 */
export function OnThisDay() {
  const { data } = useSWR<FavoritesResponse>("/api/on-this-day", fetcher, { revalidateOnFocus: false });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const items = data?.results ?? [];

  if (items.length === 0) return null;

  return (
    <div className="mt-9">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={16} color="var(--faint)" />
        <p className="display" style={{ fontSize: 17 }}>On this day</p>
      </div>
      <div
        className="flex gap-3"
        style={{ overflowX: "auto", paddingBottom: 4 }}
      >
        {items.map((m, i) => (
          <div key={m.id} className="shrink-0" style={{ width: 170 }}>
            <Thumb item={m} onOpen={() => setLightbox(i)} />
            <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }} className="truncate">
              {yearsAgo(m.createdTime)} · {m.path}
            </p>
          </div>
        ))}
      </div>

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox items={items} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
