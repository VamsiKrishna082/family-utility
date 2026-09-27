"use client";

import Link from "next/link";
import useSWR from "swr";
import { CalendarHeart, CreditCard, FileText, HeartPulse, Plane, Utensils } from "lucide-react";
import { daysBetween, todayIST } from "@/lib/trips/logic";
import { kcalLeft } from "@/lib/fa/day";
import type { Reminder } from "@/lib/reminders";
import type { FaDayResponse } from "@/lib/fa/types";
import type { TripsResponse } from "@/lib/trips/types";

const fetcher = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))));
const ICON = { dates: CalendarHeart, documents: FileText, trips: Plane, money: CreditCard, health: HeartPulse } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * "Today" on Home: a trip in progress, each person's calories left, and
 * what's coming up (the same list the morning reminder comes from).
 * Each part loads on its own, and the card hides when there's nothing to say.
 */
export function TodayCard() {
  const today = todayIST();
  const { data: rem } = useSWR<{ items: Reminder[] }>("/api/reminders", fetcher);
  const { data: food } = useSWR<FaDayResponse>(`/api/fa/day?date=${today}`, fetcher);
  const { data: trips } = useSWR<TripsResponse>("/api/trips", fetcher);

  const ongoing = (trips?.items ?? []).find((t) => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate);
  const items = (rem?.items ?? []).filter((r) => r.daysAway <= 7).slice(0, 6);
  const people = (food?.people ?? []).filter((p) => p.targetKcal !== null || (p.day?.entryCount ?? 0) > 0);

  if (!ongoing && !items.length && !people.length) return null;

  const row = { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line2)", fontSize: 14 } as const;
  return (
    <section className="card mt-6" style={{ padding: "14px 18px" }}>
      <p className="display" style={{ fontSize: 18, marginBottom: 4 }}>Today</p>

      {ongoing && (
        <Link href={`/trips/${ongoing.id}`} style={row}>
          <Plane size={16} color="#2f6e6b" />
          <span className="flex-1 min-w-0 truncate"><b>{ongoing.name}</b> — day {daysBetween(ongoing.startDate!, today) + 1} of {ongoing.days}. Write today&apos;s story?</span>
        </Link>
      )}

      {people.map((p) => {
        const left = kcalLeft({ target: p.targetKcal, eaten: p.day?.eatenKcal ?? 0, burned: p.day?.burnedKcal ?? 0, eatingLimit: Boolean(p.limit) });
        return (
          <Link key={p.person.id} href="/food" style={row}>
            <Utensils size={16} color="#8a5a0b" />
            <span className="flex-1 min-w-0 truncate">
              <b>{p.isYou ? "You" : p.person.name}</b>{" "}
              {left === null ? `${fmt(p.day?.eatenKcal ?? 0)} kcal logged` : left >= 0 ? `${fmt(left)} kcal left` : `${fmt(-left)} kcal over`}
              {(p.day?.entryCount ?? 0) === 0 ? " · nothing logged yet" : ""}
            </span>
          </Link>
        );
      })}

      {items.map((r) => {
        const Icon = ICON[r.kind];
        return (
          <Link key={r.key} href={r.url} style={row}>
            <Icon size={16} color={r.daysAway <= 1 ? "var(--red)" : "var(--faint)"} />
            <span className="flex-1 min-w-0">
              <span className="block truncate">{r.title}</span>
              {r.detail && <span className="block truncate" style={{ fontSize: 12, color: "var(--faint)" }}>{r.detail}</span>}
            </span>
          </Link>
        );
      })}
      {(rem?.items.length ?? 0) > items.length && (
        <p style={{ fontSize: 12, color: "var(--faint)", paddingTop: 6 }}>+{(rem?.items.length ?? 0) - items.length} more later this month</p>
      )}
    </section>
  );
}
