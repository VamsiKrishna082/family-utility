import { Firestore } from "@google-cloud/firestore";
import { required } from "@/lib/env";

let _db: Firestore | null = null;

/** Same story as drive.ts / gcs.ts: one client, reused across warm invocations. */
export function db(): Firestore {
  if (!_db) {
    // Every optional field across every section (Money's `mode`, a note, etc.)
    // is built as `field: value ?? undefined` somewhere — without this, the
    // Admin SDK throws "Cannot use 'undefined' as a Firestore value" the
    // moment any one of them is actually left unset, instead of just
    // omitting that key the way the rest of this app's code already assumes.
    _db = new Firestore({ projectId: required("GOOGLE_CLOUD_PROJECT"), ignoreUndefinedProperties: true });
  }
  return _db;
}
