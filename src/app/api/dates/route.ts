import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["birthday", "anniversary", "other"]),
  recurring: z.boolean().default(true),
  notes: z.string().max(200).default(""),
});

export const { GET, POST } = recordRoutes("dates", Body, { field: "date", direction: "asc" });
