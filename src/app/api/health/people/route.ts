import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { healthPeople } from "@/lib/healthPeople";

export const runtime = "nodejs";

/** GET — everyone with a Health page. */
export async function GET() {
  try {
    await requireUser();
    return ok({ people: await healthPeople() });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(40),
  relation: z.string().trim().max(40).optional(),
  /** Whose documents in Documents are theirs — parents by default. */
  docOwner: z.enum(["parents", "common"]).default("parents"),
});

/** POST { name, relation? } — add a family member (Amma, Appa, …) with their own page, records and reminders. */
export async function POST(req: Request) {
  try {
    await requireUser();
    const b = Body.parse(await req.json());
    const people = await healthPeople();
    if (people.some((p) => p.name.toLowerCase() === b.name.toLowerCase())) throw new Error(`${b.name} is already here`);
    const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "member";
    const id = `${slug}-${randomBytes(3).toString("hex")}`;
    const person = { id, name: b.name, ...(b.relation ? { relation: b.relation } : {}), docOwner: b.docOwner, createdAt: Date.now() };
    await db().collection("health_people").doc(id).set(person);
    return ok({ person });
  } catch (e) {
    return fail(e);
  }
}
