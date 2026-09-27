import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { personById, personForEmail } from "@/lib/fa/people";

/** Header the Food screens send when you're logging or setting targets for the other person. */
export const ACT_FOR_HEADER = "x-fa-person";

/**
 * Whose log this request is for: the signed-in person, or — when the
 * request says so with the x-fa-person header — the other of you two. Both
 * people fill things in for each other (e.g. one phone at dinner), so either
 * may write either log; the header can only ever name one of the two
 * household people, and the signed-in user is still checked against the
 * allowlist first. `me` is always the signed-in person.
 */
export async function requirePerson() {
  const user = await requireUser();
  const me = personForEmail(user.email);
  const asked = (await headers()).get(ACT_FOR_HEADER);
  if (!asked || asked === me.id) return { ...user, me, person: me };
  const person = personById(asked);
  if (!person) throw new BadRequest("Unknown person");
  return { ...user, me, person };
}

export class BadRequest extends Response {
  constructor(message: string, status = 400) {
    super(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
