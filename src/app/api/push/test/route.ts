import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { sendPush, subId, subsCol, type PushSub } from "@/lib/push";
import { digestMessage } from "@/lib/reminders";
import { morningMessage } from "@/lib/nudges";
import { FA_PEOPLE, personById } from "@/lib/fa/people";
import { todayIST } from "@/lib/fa/day";
import { loadUpcoming } from "@/lib/remindersData";

export const runtime = "nodejs";

/**
 * POST { endpoint, preview? } — sends this device a test notification; with
 * preview, sends what this morning's reminder would say (without logging it,
 * so the real one still goes out).
 */
export async function POST(req: Request) {
  try {
    await requireUser();
    const { endpoint, preview } = z.object({ endpoint: z.string().max(2000), preview: z.boolean().optional() }).parse(await req.json());
    const snap = await subsCol().doc(subId(endpoint)).get();
    if (!snap.exists) throw new Error("Reminders aren't on for this device");
    const sub = snap.data() as PushSub;
    let msg = { title: "Reminders are on", body: "You'll get a good-morning note at 8:30 with anything coming up.", url: "/settings", tag: "test" };
    if (preview) {
      const items = (await loadUpcoming()).filter((r) => r.notify && sub.prefs[r.kind]);
      const d = sub.prefs.greeting
        ? morningMessage({ name: personById(sub.person)?.name ?? "", partnerName: FA_PEOPLE.find((p) => p.id !== sub.person)?.name, date: todayIST(), items })
        : digestMessage(items);
      msg = d ? { ...d, tag: "test" } : { title: "Nothing today", body: "No reminders would go out this morning.", url: "/", tag: "test" };
    }
    const sent = await sendPush(sub, msg);
    if (!sent) throw new Error("Couldn't reach this device — turn reminders off and on again");
    return ok({ sent: true, title: msg.title });
  } catch (e) {
    return fail(e);
  }
}
