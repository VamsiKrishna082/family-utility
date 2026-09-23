import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { NW_ASSET_CLASSES, type NwSettings } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULTS: NwSettings = { reminderDay: 1 };

export async function GET() {
  try {
    await requireUser();
    const snap = await db().collection("nw_settings").doc("main").get();
    return ok({ settings: snap.exists ? (snap.data() as NwSettings) : DEFAULTS });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  targetMix: z.record(z.enum(NW_ASSET_CLASSES), z.number().min(0).max(100)).optional(),
  reminderDay: z.number().int().min(1).max(28).optional(),
});

export async function PUT(req: Request) {
  try {
    await requireUser();
    const patch = Body.parse(await req.json());
    await db().collection("nw_settings").doc("main").set(patch, { merge: true });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
