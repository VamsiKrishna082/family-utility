export type UploadProgress = {
  name: string;
  percent: number;
  state: "uploading" | "done" | "error";
  error?: string;
};

/** Resolves with the created file's Drive id when Google's response is readable (the session URL asks for `fields=id`) — null in the rare CORS-blocked-but-bytes-sent fallback case, where the caller decides whether the id is required. */
function put(uploadUrl: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    // True once all bytes have left the browser. Set before xhr.onload/onerror
    // so we can tell a real network failure from a CORS-blocked success response.
    let allBytesSent = false;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    // Fires when the browser has finished sending bytes — before Drive responds.
    xhr.upload.onload = () => { allBytesSent = true; };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as { id?: string };
        resolve(body.id ?? null);
      } catch {
        resolve(null);
      }
    };

    // Drive's resumable upload endpoint sometimes returns a response without CORS
    // headers (or follows a redirect that drops them), which the browser reports as
    // a network error even though Drive received all the bytes. If we already sent
    // everything, treat it as success — but the response body (and so the file id)
    // isn't readable in this path.
    xhr.onerror = () => {
      if (allBytesSent) resolve(null);
      else reject(new Error("Network dropped during upload"));
    };

    xhr.send(file);
  });
}

/** Ask for a session, then send the file straight to Google. Two steps, no bookkeeping. Returns the created file's Drive id when readable (see `put`). */
export async function uploadOne(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void,
  sessionEndpoint = "/api/uploads/session",
): Promise<string | null> {
  const mimeType = file.type || "application/octet-stream";

  const res = await fetch(sessionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId, name: file.name, mimeType, size: file.size }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not start the upload");

  const { uploadUrl } = (await res.json()) as { uploadUrl: string };
  return put(uploadUrl, file, onProgress);
}

/**
 * `uploadOne`, but when Drive's response is unreadable (the CORS quirk
 * documented on `put` — reliably hit in some environments, not just a rare
 * edge case) falls back to asking the server to find the file it just
 * created by name. Throws if even that comes up empty, rather than saving a
 * metadata record with no linked file.
 */
export async function uploadOneOrFind(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void,
  sessionEndpoint: string,
  findEndpoint: string,
): Promise<string> {
  const id = await uploadOne(file, folderId, onProgress, sessionEndpoint);
  if (id) return id;

  const res = await fetch(findEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name }),
  });
  if (!res.ok) throw new Error("Upload finished but we couldn't confirm the file — please try again");
  const { driveFileId } = (await res.json()) as { driveFileId: string | null };
  if (!driveFileId) throw new Error("Upload finished but we couldn't confirm the file — please try again");
  return driveFileId;
}
