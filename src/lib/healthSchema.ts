import { z } from "zod";
import { HEALTH_KINDS, HEALTH_PEOPLE } from "@/lib/health";

/** Validation for health items — shared by the create and edit routes (route files may only export handlers). */
const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const HealthFields = z.object({
  person: z.enum(HEALTH_PEOPLE.map((p) => p.id) as [string, ...string[]]),
  kind: z.enum(HEALTH_KINDS),
  title: z.string().trim().min(1).max(120),
  date: Ymd.optional(),
  nextDate: Ymd.optional(),
  everyDays: z.number().int().min(1).max(3650).optional(),
  doctor: z.string().trim().max(120).optional(),
  dose: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  active: z.boolean().optional(),
});
