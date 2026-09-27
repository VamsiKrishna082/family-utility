import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { db } from "@/lib/firestore";
import { REMINDER_KINDS, type ReminderKind } from "@/lib/reminders";

/**
 * Web Push (VAPID) for reminders. Keys live in env: VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY (generate once with `npx web-push generate-vapid-keys`).
 * The VAPID "subject" is the site's own URL — push services get a contact
 * address, never anyone's email. Subscriptions: Firestore push_subs, one
 * doc per device, keyed by a hash of its endpoint.
 */
export const PUSH_KINDS = [...REMINDER_KINDS, "food", "greeting", "partner", "night"] as const;
export type PushKind = ReminderKind | "food" | "greeting" | "partner" | "night";
export type PushPrefs = Record<PushKind, boolean>;
export const DEFAULT_PREFS: PushPrefs = { dates: true, documents: true, trips: true, money: true, health: true, food: false, greeting: true, partner: true, night: true };

export type PushSub = {
  id: string;
  email: string;
  /** Food person id — the evening "log dinner?" nudge is per person. */
  person: string;
  subscription: PushSubscription;
  prefs: PushPrefs;
  device: string;
  createdAt: number;
  lastSentAt?: number;
};

export const subsCol = () => db().collection("push_subs");
export const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function setup() {
  if (configured) return;
  if (!pushConfigured()) throw new Error("Reminders aren't set up on the server (no VAPID keys)");
  webpush.setVapidDetails(process.env.AUTH_URL || "https://localhost", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends one notification. A device that has unsubscribed (404/410) is removed; returns whether it arrived at the push service. */
export async function sendPush(sub: Pick<PushSub, "id" | "subscription">, msg: PushMessage): Promise<boolean> {
  setup();
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(msg), { TTL: 6 * 60 * 60, urgency: "normal" });
    await subsCol().doc(sub.id).set({ lastSentAt: Date.now() }, { merge: true }).catch(() => undefined);
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await subsCol().doc(sub.id).delete().catch(() => undefined);
    return false;
  }
}

export function normalizePrefs(p: Partial<PushPrefs> | undefined): PushPrefs {
  return Object.fromEntries(PUSH_KINDS.map((k) => [k, typeof p?.[k] === "boolean" ? p[k] : DEFAULT_PREFS[k]])) as PushPrefs;
}
