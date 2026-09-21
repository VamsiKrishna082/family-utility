import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["asset", "liability"]),
  category: z.string().min(1),
  value: z.number().nonnegative(),
});

export const { GET, POST } = recordRoutes("worth_accounts", Body, { field: "updatedAt", direction: "desc" });
