import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { requirePerson } from "@/lib/fa/auth";
import { FA_PEOPLE } from "@/lib/fa/people";
import { COL, getLimit, getProfile } from "@/lib/fa/store";
import { effectiveTarget } from "@/lib/fa/targets";
import { dateRange, loggingStreak, strip, todayIST } from "@/lib/fa/day";
import type { FaDay, FaDayResponse, FaEntry, FaMeal, FaPersonDay, FaStatus } from "@/lib/fa/types";
import { FA_MEALS } from "@/lib/fa/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/fa/day?date= — both people's day (you edit only yours), with
 * totals, entries by meal, streak and 7/14-day strips. The day screen reads
 * one day doc + that day's entries per person; the strips come from the
 * person's day docs (one small doc per logged day).
 */
export async function GET(req: Request) {
  try {
    const { person: me } = await requirePerson();
    const url = new URL(req.url);
    const today = todayIST();
    const date = url.searchParams.get("date") ?? today;
    if (!DATE_RE.test(date)) throw new Error("Bad date");

    const loggedByPerson = new Map<string, Set<string>>();
    const people: FaPersonDay[] = await Promise.all(
      FA_PEOPLE.map(async (person) => {
        const [profile, limit, entriesSnap, daysSnap, weightsSnap] = await Promise.all([
          getProfile(person.id),
          getLimit(person.id),
          db().collection(COL.entries).where("person", "==", person.id).where("date", "==", date).get(),
          db().collection(COL.days).where("person", "==", person.id).get(),
          db().collection(COL.weights).where("person", "==", person.id).get(),
        ]);
        const mealOrder = (m: FaMeal) => FA_MEALS.indexOf(m);
        const entries = entriesSnap.docs
          .map((d) => d.data() as FaEntry)
          .sort((a, b) => mealOrder(a.meal) - mealOrder(b.meal) || a.createdAt - b.createdAt);

        const days = daysSnap.docs.map((d) => d.data() as FaDay).filter((d) => d.date <= date);
        const byDate = new Map(days.map((d) => [d.date, d]));
        const statusByDate = new Map<string, FaStatus>(days.map((d) => [d.date, d.status]));
        const logged = new Set(days.filter((d) => d.entryCount > 0).map((d) => d.date));
        loggedByPerson.set(person.id, logged);

        const last7 = dateRange(date, 7);
        const last14 = dateRange(date, 14);
        const onTarget = (dates: string[]) => dates.filter((d) => statusByDate.get(d) === "on").length;
        const loggedIn7 = last7.map((d) => byDate.get(d)).filter((d): d is FaDay => !!d && d.entryCount > 0);
        const proteinHit7 = loggedIn7.filter((d) => d.proteinTargetG && d.protein >= d.proteinTargetG * 0.9).length;
        const avgProtein7 = loggedIn7.length ? Math.round(loggedIn7.reduce((s, d) => s + d.protein, 0) / loggedIn7.length) : 0;
        const stepsWeek = last7.reduce((s, d) => s + (byDate.get(d)?.steps ?? 0), 0);
        const prevSteps = dateRange(date, 8).slice(0, 7).map((d) => byDate.get(d)?.steps ?? 0).filter((s) => s > 0);
        const stepsDefault = prevSteps.length ? Math.round(prevSteps.reduce((s, n) => s + n, 0) / prevSteps.length / 100) * 100 : null;

        // 7-day rolling average weight, not the latest single reading (water weight swings).
        const weights = weightsSnap.docs
          .map((d) => d.data() as { date: string; weightKg: number })
          .filter((w) => last7.includes(w.date));
        const weightAvg7 = weights.length ? Math.round((weights.reduce((s, w) => s + w.weightKg, 0) / weights.length) * 10) / 10 : null;

        return {
          person,
          isYou: person.id === me.id,
          profile,
          limit,
          targetKcal: effectiveTarget(profile, limit).target,
          day: byDate.get(date) ?? null,
          entries,
          strip14: strip(statusByDate, date, 14),
          loggingStreak: loggingStreak(logged, date, today),
          daysLogged: logged.size,
          onTarget7: onTarget(last7),
          onTarget14: onTarget(last14),
          proteinHit7,
          avgProtein7,
          stepsWeek,
          stepsDefault,
          weightAvg7,
        };
      }),
    );

    // "Logged together": consecutive days both people have entries.
    const sets = [...loggedByPerson.values()];
    const both = new Set([...(sets[0] ?? [])].filter((d) => sets.every((set) => set.has(d))));

    const res: FaDayResponse = {
      date,
      people: people.sort((a, b) => Number(b.isYou) - Number(a.isYou)),
      loggedTogetherStreak: loggingStreak(both, date, today),
      aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
    };
    return ok(res);
  } catch (e) {
    return fail(e);
  }
}
