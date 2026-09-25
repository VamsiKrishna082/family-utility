"use client";

import Link from "next/link";
import { countdownLabel, MONTHS, yearsLabel } from "@/lib/dates/logic";
import { TYPE_COLOR, useDates } from "@/components/dates/shared";

/** Home-page strip: the next few dates within a month, today's first. Renders nothing when there are none. */
export function UpcomingDates() {
  const { rows } = useDates();
  const soon = rows.filter((r) => !r.occ.past && r.occ.daysAway <= 30).slice(0, 4);
  if (!soon.length) return null;
  return (
    <section className="mt-9">
      <div className="flex items-baseline justify-between mb-3">
        <p className="display" style={{ fontSize: 19 }}>Coming up</p>
        <Link href="/dates" style={{ fontSize: 13, color: "var(--indigo)", fontWeight: 600 }}>All dates</Link>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
        {soon.map(({ ev, occ }) => {
          const c = TYPE_COLOR[ev.type];
          const label = yearsLabel(ev.type, occ.years);
          const today = occ.daysAway === 0;
          return (
            <Link key={ev.id} href="/dates" className="card flex items-center gap-3" style={{ padding: 12, borderColor: today ? c.ink : undefined }}>
              <span className="flex flex-col items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 11, background: c.tint, color: c.ink }}>
                <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{occ.date.d}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{MONTHS[occ.date.m - 1]}</span>
              </span>
              <span className="min-w-0">
                <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>{ev.title}</span>
                <span className="block truncate" style={{ fontSize: 12, color: today ? c.ink : "var(--faint)", fontWeight: today ? 700 : 400 }}>
                  {countdownLabel(occ.daysAway)}{label ? ` · ${label}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
