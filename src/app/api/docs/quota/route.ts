import { requireUser } from "@/lib/auth";
import { driveStorageQuota } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import type { DriveQuota } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    const quota: DriveQuota = await driveStorageQuota();
    return ok(quota);
  } catch (e) {
    return fail(e);
  }
}
