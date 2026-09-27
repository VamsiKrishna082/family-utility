/**
 * Health records — pure types and helpers (tested in scripts/health.test.mjs).
 * People line up with Documents' owners, so each person's Medical documents
 * show on their page.
 */
export type HealthPerson = { id: string; name: string; docOwner: "yours" | "hers" | "parents" | "common"; relation?: string; custom?: boolean };

/** The two of you are always here; family members (Amma, Appa, …) are added on the page and stored in health_people. */
export const HEALTH_PEOPLE: HealthPerson[] = [
  { id: "vamsi", name: "Vamsi", docOwner: "yours" },
  { id: "varshini", name: "Varshini", docOwner: "hers" },
];
export type HealthPersonId = string;

export const HEALTH_KINDS = ["visit", "medicine", "test", "vaccine"] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];
export const HEALTH_KIND_LABEL: Record<HealthKind, string> = { visit: "Doctor visit", medicine: "Medicine", test: "Test / scan", vaccine: "Vaccine" };
/** What the "next" date means for each kind. */
export const HEALTH_NEXT_LABEL: Record<HealthKind, string> = { visit: "Next check-up", medicine: "Refill due", test: "Repeat test", vaccine: "Next dose" };

export type HealthItem = {
  id: string;
  person: HealthPersonId;
  kind: HealthKind;
  title: string;
  /** When it happened / started (YYYY-MM-DD). */
  date?: string;
  /** Next check-up, refill, repeat test or dose. */
  nextDate?: string;
  /** Repeats every N days — "Done" sets the next date from today. */
  everyDays?: number;
  doctor?: string;
  dose?: string;
  notes?: string;
  /** Medicines: still taking it. */
  active?: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type HealthProfile = {
  person: HealthPersonId;
  bloodGroup?: string;
  allergies: string[];
  conditions: string[];
  notes?: string;
  updatedAt: number;
};

export const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"] as const;

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Done" on a repeating item: it happened today, and the next one is `everyDays` from today. */
export function markDone(item: Pick<HealthItem, "everyDays" | "nextDate">, today: string): { date: string; nextDate?: string } {
  return { date: today, ...(item.everyDays ? { nextDate: addDays(today, item.everyDays) } : {}) };
}

/** Items with a next date in the coming `withinDays` (or overdue), soonest first. */
export function comingUp(items: HealthItem[], today: string, withinDays = 60): HealthItem[] {
  const limit = addDays(today, withinDays);
  return items
    .filter((i) => i.nextDate && i.nextDate <= limit && i.active !== false)
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!));
}
