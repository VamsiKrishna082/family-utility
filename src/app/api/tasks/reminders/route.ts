import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { todayIST } from "@/lib/fa/day";
import { sendPush, subsCol, type PushSub } from "@/lib/push";
import { digestMessage } from "@/lib/reminders";
import { morningMessage, nightMessage, partnerMessage } from "@/lib/nudges";
import { FA_PEOPLE, personById } from "@/lib/fa/people";
import { loadUpcoming } from "@/lib/remindersData";
import type { FaEntry, FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

/**
 * POST /api/tasks/reminders?slot=morning|afternoon|evening|night — called by
 * Cloud Scheduler with the x-cron-secret header (8:30, 13:30, and the evening
 * job at both 20:30 and 22:30 IST — the 22:30 run is "night"). Not behind the
 * session (middleware skips /api/tasks); the secret is the gate.
 *   morning:   "Good morning, <name>" with what's due today (or just the
 *              digest if the greeting is off); nothing is sent twice a day.
 *   afternoon: a nudge to check in with your partner (the other person).
 *   evening:   "Log dinner?" to a person who hasn't logged it.
 *   night:     "Good night, <name>".
 * The morning, afternoon and night notes end with "Love you ❤️ — <partner>".
 */
function authorised(req: Request): boolean {
  const want = process.env.CRON_SECRET;
  const got = req.headers.get("x-cron-secret");
  if (!want || !got) return false;
  const a = Buffer.from(want), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try {
    if (!authorised(req)) return new Response("Forbidden", { status: 403 });
    let slot = new URL(req.url).searchParams.get("slot") ?? "morning";
    // One evening job runs at 20:30 and 22:30 (keeps us within the free 3 jobs); the late run is good night.
    const hourIST = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));
    if (slot === "evening" && hourIST >= 22) slot = "night";
    const date = todayIST();
    const subs = (await subsCol().get()).docs.map((d) => d.data() as PushSub);
    if (!subs.length) return ok({ slot, devices: 0, sent: 0 });

    if (slot === "night") {
      const sentKey = `night-${date}`;
      const logRef = db().collection("reminder_log").doc(date);
      const log = new Set<string>(((await logRef.get()).data()?.keys as string[] | undefined) ?? []);
      let sent = 0;
      for (const sub of subs.filter((s) => s.prefs.night !== false && !log.has(`${sentKey}:${s.id}`))) {
        const partner = FA_PEOPLE.find((p) => p.id !== sub.person);
        if (await sendPush(sub, { ...nightMessage({ name: personById(sub.person)?.name ?? "", partnerName: partner?.name, date }), tag: sentKey })) {
          sent++;
          log.add(`${sentKey}:${sub.id}`);
        }
      }
      if (sent) await logRef.set({ date, keys: [...log], updatedAt: Date.now() }, { merge: true });
      return ok({ slot, devices: subs.length, sent });
    }

    if (slot === "afternoon") {
      const sentKey = `partner-${date}`;
      const logRef = db().collection("reminder_log").doc(date);
      const log = new Set<string>(((await logRef.get()).data()?.keys as string[] | undefined) ?? []);
      let sent = 0;
      for (const sub of subs.filter((s) => s.prefs.partner !== false && !log.has(`${sentKey}:${s.id}`))) {
        const partner = FA_PEOPLE.find((p) => p.id !== sub.person);
        if (!partner) continue;
        if (await sendPush(sub, { ...partnerMessage({ partnerName: partner.name, date }), tag: sentKey })) {
          sent++;
          log.add(`${sentKey}:${sub.id}`);
        }
      }
      if (sent) await logRef.set({ date, keys: [...log], updatedAt: Date.now() }, { merge: true });
      return ok({ slot, devices: subs.length, sent });
    }

    if (slot === "evening") {
      let sent = 0;
      for (const sub of subs.filter((s) => s.prefs.food)) {
        const [profileSnap, entriesSnap] = await Promise.all([
          db().collection("fa_profiles").doc(sub.person).get(),
          db().collection("fa_entries").where("person", "==", sub.person).where("date", "==", date).get(),
        ]);
        const profile = profileSnap.exists ? (profileSnap.data() as FaProfile) : null;
        if (profile && profile.remindersOn === false) continue;
        if (entriesSnap.docs.some((d) => (d.data() as FaEntry).meal === "dinner")) continue;
        if (await sendPush(sub, { title: "Log dinner?", body: "A quick entry keeps today's numbers right.", url: "/food", tag: `food-${date}` })) sent++;
      }
      return ok({ slot, devices: subs.length, sent });
    }

    // Morning: one digest per device; the day's log keeps a reminder from being sent twice (e.g. a retried job).
    const logRef = db().collection("reminder_log").doc(date);
    const log = new Set<string>(((await logRef.get()).data()?.keys as string[] | undefined) ?? []);
    const due = (await loadUpcoming()).filter((r) => r.notify && !log.has(r.key));
    // "Once" reminders (a budget crossing 80% / 100%) are sent a single time, not every morning after.
    const onceKeys = due.filter((r) => r.once).map((r) => r.key);
    const onceSeen = new Set<string>();
    if (onceKeys.length) {
      const snaps = await db().getAll(...onceKeys.map((k) => db().collection("reminder_once").doc(encodeURIComponent(k))));
      snaps.forEach((s, i) => { if (s.exists) onceSeen.add(onceKeys[i]); });
    }
    const items = due.filter((r) => !onceSeen.has(r.key));
    let sent = 0;
    const delivered = new Set<string>();
    for (const sub of subs) {
      if (log.has(`greeting-${date}:${sub.id}`)) continue; // a retried job doesn't greet twice
      const mine = items.filter((r) => sub.prefs[r.kind]);
      const msg = sub.prefs.greeting !== false
        ? morningMessage({ name: personById(sub.person)?.name ?? "", partnerName: FA_PEOPLE.find((p) => p.id !== sub.person)?.name, date, items: mine })
        : digestMessage(mine);
      if (!msg) continue;
      if (await sendPush(sub, { ...msg, tag: `digest-${date}` })) {
        delivered.add(`greeting-${date}:${sub.id}`);
        sent++;
        mine.forEach((r) => delivered.add(r.key));
      }
    }
    if (delivered.size) {
      await logRef.set({ date, keys: [...log, ...delivered], updatedAt: Date.now() });
      const batch = db().batch();
      for (const r of items) if (r.once && delivered.has(r.key)) batch.set(db().collection("reminder_once").doc(encodeURIComponent(r.key)), { key: r.key, sentOn: date });
      await batch.commit();
    }
    return ok({ slot, devices: subs.length, reminders: items.length, sent });
  } catch (e) {
    return fail(e);
  }
}
