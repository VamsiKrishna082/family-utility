import Link from "next/link";
import { SECTIONS } from "@/lib/sections";
import { OnThisDay } from "@/components/OnThisDay";
import { UpcomingDates } from "@/components/dates/UpcomingDates";
import { TripMemories } from "@/components/trips/TripMemories";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TodayCard } from "@/components/TodayCard";

// Rendered on the server, which runs in UTC on Cloud Run — so the hour and
// date are taken in India time explicitly (it said "Good morning" at 2 PM).
function greeting(): string {
  const h = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

export default function Launcher() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div>
      <p style={{ color: "var(--faint)", fontSize: 14 }}>{today}</p>
      <h1 className="display" style={{ fontSize: 38, marginTop: 6, lineHeight: 1.1 }}>
        {greeting()}
      </h1>
      <InstallPrompt />
      <TodayCard />

      <div
        className="mt-9"
        style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))" }}
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const tile = (
            <>
              <span
                className="flex items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 13, background: s.tint }}
              >
                <Icon size={21} color={s.ink} strokeWidth={1.8} />
              </span>
              <p className="display" style={{ fontSize: 18, marginTop: 16 }}>{s.name}</p>
              <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 3 }}>{s.blurb}</p>
              <p style={{ color: s.ready ? s.ink : "var(--faint)", fontSize: 12.5, marginTop: 12 }}>
                {s.ready ? "Open" : "Not built yet"}
              </p>
            </>
          );

          return s.ready ? (
            <Link key={s.key} href={s.href} className="card text-left" style={{ padding: 20, display: "block" }}>
              {tile}
            </Link>
          ) : (
            <div key={s.key} className="card" style={{ padding: 20, opacity: 0.5 }}>
              {tile}
            </div>
          );
        })}
      </div>

      <UpcomingDates />
      <TripMemories />
      <OnThisDay />
    </div>
  );
}
