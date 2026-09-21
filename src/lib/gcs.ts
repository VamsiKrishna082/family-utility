import { Storage } from "@google-cloud/storage";
import { required } from "@/lib/env";

let _storage: Storage | null = null;

function storage() {
  if (!_storage) _storage = new Storage({ projectId: required("GOOGLE_CLOUD_PROJECT") });
  return _storage;
}

function bucket() {
  return storage().bucket(required("GCS_BUCKET"));
}

export async function gcsExists(key: string): Promise<boolean> {
  const [exists] = await bucket().file(key).exists();
  return exists;
}

export async function gcsUpload(key: string, data: Buffer, contentType: string): Promise<void> {
  await bucket().file(key).save(data, { contentType, resumable: false });
}

export async function gcsDownload(key: string): Promise<Buffer> {
  const [data] = await bucket().file(key).download();
  return data;
}
