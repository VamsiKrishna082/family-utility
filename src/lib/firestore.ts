import { Firestore } from "@google-cloud/firestore";
import { required } from "@/lib/env";

let _db: Firestore | null = null;

/** Same story as drive.ts / gcs.ts: one client, reused across warm invocations. */
export function db(): Firestore {
  if (!_db) _db = new Firestore({ projectId: required("GOOGLE_CLOUD_PROJECT") });
  return _db;
}
