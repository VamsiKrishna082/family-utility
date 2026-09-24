import { requireUser } from "@/lib/auth";
import { personForEmail } from "@/lib/fa/people";

/** The signed-in person. Each person only ever writes their own log — the id comes from the session, never the request body. */
export async function requirePerson() {
  const user = await requireUser();
  return { ...user, person: personForEmail(user.email) };
}

export class BadRequest extends Response {
  constructor(message: string, status = 400) {
    super(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
  }
}
