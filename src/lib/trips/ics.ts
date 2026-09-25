import { icsEscape } from "@/lib/dates/logic";
import { addDays } from "@/lib/trips/logic";
import { TRIP_BOOKING_LABEL, type Trip } from "@/lib/trips/types";

/**
 * Calendar-feed events for trips (appended to the Dates feed, so one
 * subscription covers both): the trip itself as an all-day span, every
 * dated booking (timed ones in IST, with alerts a day and 3 hours before),
 * and every open to-do with a due date. Only trips that haven't ended more
 * than a week ago — the calendar is for what's coming.
 */
export function tripIcsLines(trips: Trip[], today: string): string[] {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const d = (s: string) => s.replace(/-/g, "");
  const alarm = (trigger: string, text: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  const out: string[] = [];

  for (const t of trips) {
    if (!t.startDate || !t.endDate || t.endDate < addDays(today, -7)) continue;
    out.push(
      "BEGIN:VEVENT", `UID:${t.id}-trip@household-trips`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d(t.startDate)}`, `DTEND;VALUE=DATE:${d(addDays(t.endDate, 1))}`,
      `SUMMARY:${icsEscape(`✈ ${t.name}`)}`,
      ...(t.destination ? [`LOCATION:${icsEscape(t.destination)}`] : []),
      "TRANSP:TRANSPARENT",
      ...alarm("-P0DT15H", `${t.name} starts tomorrow`),
      "END:VEVENT",
    );
    for (const b of t.bookings) {
      if (!b.date) continue;
      const summary = `${TRIP_BOOKING_LABEL[b.kind]}: ${b.title}`;
      const desc = [b.confirmation ? `PNR / confirmation: ${b.confirmation}` : "", b.notes ?? "", `Trip: ${t.name}`].filter(Boolean).join("\n");
      out.push("BEGIN:VEVENT", `UID:${t.id}-b-${b.id}@household-trips`, `DTSTAMP:${stamp}`);
      if (b.time) {
        const start = `${d(b.date)}T${b.time.replace(":", "")}00`;
        out.push(`DTSTART;TZID=Asia/Kolkata:${start}`, "DURATION:PT1H", `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(desc)}`,
          ...alarm("-P1D", `Tomorrow: ${summary}`), ...alarm("-PT3H", `In 3 hours: ${summary}`));
      } else {
        out.push(`DTSTART;VALUE=DATE:${d(b.date)}`, `DTEND;VALUE=DATE:${d(addDays(b.date, 1))}`, `SUMMARY:${icsEscape(summary)}`, `DESCRIPTION:${icsEscape(desc)}`,
          "TRANSP:TRANSPARENT", ...alarm("-P0DT15H", `Tomorrow: ${summary}`));
      }
      out.push("END:VEVENT");
    }
    for (const todo of t.todos) {
      if (todo.done || !todo.due) continue;
      out.push(
        "BEGIN:VEVENT", `UID:${t.id}-t-${todo.id}@household-trips`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d(todo.due)}`, `DTEND;VALUE=DATE:${d(addDays(todo.due, 1))}`,
        `SUMMARY:${icsEscape(`☐ ${todo.text} (${t.name})`)}`, "TRANSP:TRANSPARENT",
        ...alarm("PT9H", `To do for ${t.name}: ${todo.text}`),
        "END:VEVENT",
      );
    }
  }
  return out;
}
