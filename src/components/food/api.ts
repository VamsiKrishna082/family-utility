/**
 * Tiny fetch helpers shared by the Food & activity components. `as` names
 * the person the request is for (logging or targets for the other of you);
 * it travels in a header the server checks. SWR keys add "#<person>" so each
 * person's data is cached separately — fetch never sends the "#…" part.
 */
const ACT_FOR = "x-fa-person";
const actFor = (as?: string): Record<string, string> => (as ? { [ACT_FOR]: as } : {});

export async function getJson<T>(url: string, as?: string): Promise<T> {
  const [path, hashAs] = url.split("#");
  const r = await fetch(path, { headers: actFor(as ?? hashAs) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not load");
  return r.json();
}

export async function send<T = unknown>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown, as?: string): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...actFor(as) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Something went wrong");
  return r.json();
}

/** Downscales a photo to ≤1024px JPEG before it's sent for an estimate — phone photos are far bigger than needed. */
export async function fileToJpegBase64(file: File, max = 1024): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
