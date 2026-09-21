import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  category: z.string().min(1),
  note: z.string().max(200).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const { GET, POST } = recordRoutes("money_entries", Body, { field: "date", direction: "desc" });
