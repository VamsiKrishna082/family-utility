import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { EmergencyCard } from "@/lib/types";

export const runtime = "nodejs";

const EMPTY: EmergencyCard = {
  bloodType: { vamsi: "", partner: "" },
  allergies: "",
  address: "",
  contacts: [],
  doctor: "",
  insurance: "",
  updatedAt: 0,
};

const Body = z.object({
  bloodType: z.object({ vamsi: z.string().max(10), partner: z.string().max(10) }),
  allergies: z.string().max(500),
  address: z.string().max(500),
  contacts: z.array(
    z.object({ id: z.string(), name: z.string().min(1).max(60), relation: z.string().max(40), phone: z.string().max(30) }),
  ),
  doctor: z.string().max(200),
  insurance: z.string().max(200),
});

/** One document, not a collection — there's only ever one emergency card. */
export async function GET() {
  try {
    await requireUser();
    const doc = await db().collection("emergency").doc("card").get();
    return ok(doc.exists ? doc.data() : EMPTY);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    await db()
      .collection("emergency")
      .doc("card")
      .set({ ...body, updatedAt: Date.now() });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
