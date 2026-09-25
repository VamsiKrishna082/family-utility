import { z } from "zod";

/** A "someday" place on the Trips ideas board. */
export const IdeaFields = z.object({
  place: z.string().trim().min(1).max(80),
  why: z.string().max(500).optional(),
  bestSeason: z.string().trim().max(60).optional(),
  roughCostRupees: z.number().min(0).max(100_000_000).optional(),
  days: z.number().int().min(1).max(90).optional(),
  link: z.string().trim().max(1000).optional(),
  votes: z.array(z.string().max(40)).max(10).optional(),
});
