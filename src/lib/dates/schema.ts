import { z } from "zod";
import { DT_RELATIONS, DT_REMIND_OPTIONS, DT_SIDES, DT_TYPES } from "@/lib/dates/types";

const Gift = z.object({
  year: z.number().int().min(1900).max(2200),
  what: z.string().trim().min(1).max(120),
  amountRupees: z.number().min(0).max(10_000_000).optional(),
});

/** Shape accepted on create; PATCH accepts any subset. Calendar validity (e.g. 31 Feb) is checked separately. */
export const DtEventBody = z.object({
  type: z.enum(DT_TYPES),
  title: z.string().trim().min(1).max(100),
  person: z.string().trim().max(80).optional(),
  relation: z.enum(DT_RELATIONS).optional(),
  side: z.enum(DT_SIDES).optional(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2200).optional(),
  recurring: z.boolean(),
  phone: z.string().trim().max(20).optional(),
  notes: z.string().max(1000).default(""),
  remindDays: z.array(z.number().int().refine((n) => (DT_REMIND_OPTIONS as readonly number[]).includes(n))).max(6).default([1, 0]),
  giftIdeas: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  gifts: z.array(Gift).max(100).default([]),
});

/** Rejects 30 Feb, 31 Apr, …; 29 Feb is allowed (it falls on 28 Feb in other years). One-time dates need a year. */
export function checkCalendar(v: { month: number; day: number; year?: number; recurring: boolean }): string | null {
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][v.month - 1];
  if (v.day > max) return "That day doesn't exist in that month";
  if (!v.recurring && !v.year) return "A one-time date needs a year";
  if (v.year && v.month === 2 && v.day === 29) {
    const leap = (v.year % 4 === 0 && v.year % 100 !== 0) || v.year % 400 === 0;
    if (!leap) return `${v.year} wasn't a leap year`;
  }
  return null;
}
