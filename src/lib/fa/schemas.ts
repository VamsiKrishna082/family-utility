import { z } from "zod";
import { FA_MEALS, FA_SOURCES } from "@/lib/fa/types";

export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const n = z.number().finite().min(0).max(20000);

export const Nutrition = z.object({ kcal: n, protein: n, carbs: n, fat: n, fibre: n });

export const Food = z.object({
  key: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  brand: z.string().max(120).optional(),
  barcode: z.string().max(40).optional(),
  source: z.enum(FA_SOURCES),
  baseLabel: z.string().max(60),
  gramsPerBase: z.number().positive().max(5000).optional(),
  base: Nutrition,
  servings: z.array(z.object({ label: z.string().max(60), mult: z.number().positive().max(100) })).max(12),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

export const Meal = z.enum(FA_MEALS);
