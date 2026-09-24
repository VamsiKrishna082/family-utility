import type { FaPerson } from "@/lib/fa/types";

/**
 * The two people this log is for. Each keeps their own log; both can see
 * both, only you edit yours (food.md). Sign-in is by email and one person
 * signs in with more than one address, so the email maps to a person here
 * rather than using the email itself as the id.
 */
export const FA_PEOPLE: FaPerson[] = [
  { id: "vamsi", name: "Vamsi" },
  { id: "varshini", name: "Varshini" },
];

export function personForEmail(email: string): FaPerson {
  const local = email.toLowerCase().split("@")[0];
  return local.startsWith("var") ? FA_PEOPLE[1] : FA_PEOPLE[0];
}

export function personById(id: string): FaPerson | undefined {
  return FA_PEOPLE.find((p) => p.id === id);
}
