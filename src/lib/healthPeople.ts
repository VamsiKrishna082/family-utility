import { db } from "@/lib/firestore";
import { HEALTH_PEOPLE, type HealthPerson } from "@/lib/health";

/** Everyone with a Health page: the two of you, then family members in the order they were added. */
export async function healthPeople(): Promise<HealthPerson[]> {
  const snap = await db().collection("health_people").get();
  const extra = snap.docs
    .map((d) => d.data() as HealthPerson & { createdAt: number })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ id, name, relation, docOwner }) => ({ id, name, relation, docOwner, custom: true }));
  return [...HEALTH_PEOPLE, ...extra];
}

export async function healthPerson(id: string): Promise<HealthPerson | null> {
  return (await healthPeople()).find((p) => p.id === id) ?? null;
}
