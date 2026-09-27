import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { personForEmail } from "@/lib/fa/people";
import { ok, fail } from "@/lib/http";
import { normalizePrefs, pushConfigured, subId, subsCol, type PushSub } from "@/lib/push";

export const runtime = "nodejs";

const Sub = z.object({
  endpoint: z.string().url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const Prefs = z.object({ dates: z.boolean(), documents: z.boolean(), trips: z.boolean(), money: z.boolean(), health: z.boolean(), food: z.boolean() }).partial();

/** GET ?endpoint= — whether reminders are set up on the server, the public key, and this device's choices (if subscribed). */
export async function GET(req: Request) {
  try {
    await requireUser();
    const endpoint = new URL(req.url).searchParams.get("endpoint");
    const doc = endpoint ? await subsCol().doc(subId(endpoint)).get() : null;
    const sub = doc?.exists ? (doc.data() as PushSub) : null;
    return ok({
      configured: pushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      subscribed: Boolean(sub),
      prefs: normalizePrefs(sub?.prefs),
    });
  } catch (e) {
    return fail(e);
  }
}

/** POST { subscription, prefs?, device } — turn reminders on for this device (or refresh its subscription). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = z.object({ subscription: Sub, prefs: Prefs.optional(), device: z.string().max(80).default("") }).parse(await req.json());
    const id = subId(body.subscription.endpoint);
    const existing = await subsCol().doc(id).get();
    const sub: PushSub = {
      id,
      email: user.email,
      person: personForEmail(user.email).id,
      subscription: { endpoint: body.subscription.endpoint, keys: body.subscription.keys },
      prefs: normalizePrefs({ ...(existing.exists ? (existing.data() as PushSub).prefs : {}), ...body.prefs }),
      device: body.device,
      createdAt: existing.exists ? (existing.data() as PushSub).createdAt : Date.now(),
    };
    await subsCol().doc(id).set(sub);
    return ok({ prefs: sub.prefs });
  } catch (e) {
    return fail(e);
  }
}

/** PATCH { endpoint, prefs } — change which reminders this device gets. */
export async function PATCH(req: Request) {
  try {
    await requireUser();
    const { endpoint, prefs } = z.object({ endpoint: z.string().max(2000), prefs: Prefs }).parse(await req.json());
    const ref = subsCol().doc(subId(endpoint));
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Reminders aren't on for this device");
    const next = normalizePrefs({ ...(snap.data() as PushSub).prefs, ...prefs });
    await ref.update({ prefs: next });
    return ok({ prefs: next });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE { endpoint } — turn reminders off for this device. */
export async function DELETE(req: Request) {
  try {
    await requireUser();
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(await req.json());
    await subsCol().doc(subId(endpoint)).delete();
    return ok({ off: true });
  } catch (e) {
    return fail(e);
  }
}
