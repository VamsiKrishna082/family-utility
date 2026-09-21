import { z } from "zod";
import { recordRoutes } from "@/lib/records";

export const runtime = "nodejs";

const Body = z.object({
  title: z.string().min(1).max(120),
  url: z.string().max(500).default(""),
  price: z.number().nonnegative().nullable().default(null),
  category: z.string().min(1),
  notes: z.string().max(200).default(""),
  done: z.boolean().default(false),
});

export const { GET, POST } = recordRoutes("wishlist", Body);
