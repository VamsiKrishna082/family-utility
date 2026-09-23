import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { currentMonthKey, getUpdateFormRows } from "@/lib/networthEngine";

export const runtime = "nodejs";

/** GET /api/networth/update?month=YYYY-MM — the update-balances form's rows, pre-filled via carry-forward. */
export async function GET(req: Request) {
  try {
    await requireUser();
    const monthKey = new URL(req.url).searchParams.get("month") ?? currentMonthKey();
    const rows = await getUpdateFormRows(monthKey);
    return ok({ monthKey, rows });
  } catch (e) {
    return fail(e);
  }
}
