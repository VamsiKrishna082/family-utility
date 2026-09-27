import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { todayIST } from "@/lib/fa/day";
import { sendPush, subsCol, type PushSub } from "@/lib/push";
import { digestMessage } from "@/lib/reminders";
import { loadUpcoming } from "@/lib/remindersData";
import type { FaEntry, FaProfile } from "@/lib/fa/types";

export const runtime = "nodejs";

/**
 * POST /api/tasks/reminders?slot=morning|evening — called by Cloud Scheduler
 * (8:00 and 20:30 IST) with the x-cron-secret header. Not behind the session
 * (middleware skips /api/tasks); the shared secret is the gate.
 *   morning: each device gets one short digest of what's due, per its own
 *            choices; a reminder already sent today isn't sent again.
 *   evening: "Log dinner?" to a person who has nudges on and hasn't logged it.
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
    const slot = new URL(req.url).searchParams.get("slot") ?? "morning";
    const date = todayIST();
    const subs = (await subsCol().get()).docs.map((d) => d.data() as PushSub);
    if (!subs.length) return ok({ slot, devices: 0, sent: 0 });

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
      const mine = items.filter((r) => sub.prefs[r.kind]);
      const msg = digestMessage(mine);
      if (!msg) continue;
      if (await sendPush(sub, { ...msg, tag: `digest-${date}` })) {
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
