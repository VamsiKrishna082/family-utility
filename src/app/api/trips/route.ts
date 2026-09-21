import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(80),
  destination: z.string().max(80).default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget: z.number().nonnegative().default(0),
  notes: z.string().max(500).default(""),
  status: z.enum(["planning", "upcoming", "past"]).default("planning"),
});

export const { GET, POST } = recordRoutes("trips", Body, { field: "startDate", direction: "desc" });
