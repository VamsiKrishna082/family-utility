import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/firestore";
import { buildIcs, todayIST } from "@/lib/dates/logic";
import type { DtEvent } from "@/lib/dates/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /share/calendar/<token>[.ics] — the Dates calendar feed, public by
 * design (calendar apps can't sign in) and gated only by the long random
 * token from /api/dates/calendar. ?download=1 serves it as a file instead.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/, "");
  const settings = await db().collection("dates_settings").doc("main").get();
  const expected = settings.exists ? (settings.data()!.icsToken as string | undefined) : undefined;
  const a = Buffer.from(token);
  const b = Buffer.from(expected ?? "");
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Not found", { status: 404 });
  }

  const snap = await db().collection("dates").get();
  const events = snap.docs.map((d) => ({ ...(d.data() as DtEvent), id: d.id }));
  const ics = buildIcs(events, todayIST());
  const download = new URL(req.url).searchParams.has("download");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      ...(download ? { "Content-Disposition": 'attachment; filename="our-dates.ics"' } : {}),
    },
  });
}
