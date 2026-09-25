/* ------------------------------------------------------------------ */
/* Dates — birthdays, anniversaries, remembrance days and the rest     */
/* ------------------------------------------------------------------ */

export const DT_TYPES = ["birthday", "anniversary", "remembrance", "festival", "other"] as const;
export type DtType = (typeof DT_TYPES)[number];

export const DT_TYPE_LABEL: Record<DtType, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  remembrance: "Remembrance",
  festival: "Festival",
  other: "Other",
};

export const DT_RELATIONS = ["family", "in_laws", "friends", "work", "other"] as const;
export type DtRelation = (typeof DT_RELATIONS)[number];
export const DT_RELATION_LABEL: Record<DtRelation, string> = {
  family: "Family", in_laws: "In-laws", friends: "Friends", work: "Work", other: "Other",
};

export const DT_SIDES = ["vamsi", "varshini", "both"] as const;
export type DtSide = (typeof DT_SIDES)[number];
export const DT_SIDE_LABEL: Record<DtSide, string> = { vamsi: "Vamsi's side", varshini: "Varshini's side", both: "Both of ours" };

/** Reminder choices, in days before (0 = on the day). Used by the calendar feed's alerts. */
export const DT_REMIND_OPTIONS = [0, 1, 3, 7, 14, 30] as const;

export type DtGift = { year: number; what: string; amountRupees?: number };

export type DtEvent = {
  id: string;
  type: DtType;
  title: string;
  /** Who it's for — drives "Amma's birthday" titles and the WhatsApp greeting. Empty for festivals. */
  person?: string;
  relation?: DtRelation;
  side?: DtSide;
  month: number; // 1–12
  day: number; // 1–31
  /** Birth / wedding / passing year for recurring dates (optional — unlocks "turns 31"); required for one-time dates. */
  year?: number;
  recurring: boolean;
  phone?: string;
  notes: string;
  remindDays: number[];
  giftIdeas: string[];
  gifts: DtGift[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type DtEventsResponse = { items: DtEvent[] };
export type DtCalendarLinkResponse = { token: string };
