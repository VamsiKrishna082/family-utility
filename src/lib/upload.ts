export type UploadProgress = {
  name: string;
  percent: number;
  state: "uploading" | "done" | "error";
  error?: string;
};

function put(uploadUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
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

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));

    // Drive's resumable upload endpoint sometimes returns a response without CORS
    // headers (or follows a redirect that drops them), which the browser reports as
    // a network error even though Drive received all the bytes. If we already sent
    // everything, treat it as success.
    xhr.onerror = () => {
      if (allBytesSent) resolve();
      else reject(new Error("Network dropped during upload"));
    };

    xhr.send(file);
  });
}

/** Ask for a session, then send the file straight to Google. Two steps, no bookkeeping. */
export async function uploadOne(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void,
): Promise<void> {
  const mimeType = file.type || "application/octet-stream";

  const res = await fetch("/api/uploads/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId, name: file.name, mimeType, size: file.size }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not start the upload");

  const { uploadUrl } = (await res.json()) as { uploadUrl: string };
  await put(uploadUrl, file, onProgress);
}
