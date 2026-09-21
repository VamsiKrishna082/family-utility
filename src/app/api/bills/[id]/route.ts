import { recordItemRoutes } from "@/lib/records";

export const runtime = "nodejs";

export const { PATCH, DELETE } = recordItemRoutes("bills");
