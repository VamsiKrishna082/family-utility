import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(80),
  amount: z.number().positive(),
  frequency: z.enum(["monthly", "yearly", "once"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autopay: z.boolean().default(false),
  notes: z.string().max(200).default(""),
});

export const { GET, POST } = recordRoutes("bills", Body, { field: "nextDueDate", direction: "asc" });
