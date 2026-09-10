import { google, drive_v3 } from "googleapis";
import { required } from "@/lib/env";
import { TTLCache } from "@/lib/cache";
import type { Entry, Crumb } from "@/lib/types";

const FOLDER_MIME = "application/vnd.google-apps.folder";

let _drive: drive_v3.Drive | null = null;
let _oauth: InstanceType<typeof google.auth.OAuth2> | null = null;

function oauth() {
  if (!_oauth) {
    _oauth = new google.auth.OAuth2(required("GOOGLE_CLIENT_ID"), required("GOOGLE_CLIENT_SECRET"));
    _oauth.setCredentials({ refresh_token: required("DRIVE_REFRESH_TOKEN") });
  }
  return _oauth;
}

/** Every Drive call runs as the library owner, so both of you see one shared tree. */
export function drive(): drive_v3.Drive {
  if (!_drive) _drive = google.drive({ version: "v3", auth: oauth() });
  return _drive;
}

export async function accessToken(): Promise<string> {
  const t = await oauth().getAccessToken();
  if (!t.token) throw new Error("Could not mint a Drive access token — is DRIVE_REFRESH_TOKEN still valid?");
  return t.token;
}

export function rootId(): string {
  return required("DRIVE_ROOT_FOLDER_ID");
}

/* ------------------------------------------------------------------ */
/* Caches                                                              */
/* ------------------------------------------------------------------ */
const listCache  = new TTLCache<Entry[]>(60_000);
const nodeCache  = new TTLCache<{ name: string; parent: string | null }>(30 * 60_000);
// Thumbnail links from Drive are stable for ~1 hour. Caching them means repeat
// loads (second user opening the same album) skip the metadata round trip entirely.
const thumbCache = new TTLCache<string>(50 * 60_000);

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */
function durationLabel(ms?: string | null): string | null {
  const n = Number(ms ?? 0);
  if (!n) return null;
  const total = Math.round(n / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function toEntry(f: drive_v3.Schema$File): Entry {
  const isFolder = f.mimeType === FOLDER_MIME;
  const img = f.imageMediaMetadata;
  const vid = f.videoMediaMetadata;
  return {
    id: f.id!,
    name: f.name ?? "Untitled",
    kind: isFolder ? "folder" : f.mimeType?.startsWith("video/") ? "video" : "photo",
    width: img?.width ?? vid?.width ?? null,
    height: img?.height ?? vid?.height ?? null,
    durationLabel: durationLabel(vid?.durationMillis),
    createdTime: f.createdTime ?? new Date(0).toISOString(),
    hasThumb: isFolder ? false : Boolean(f.thumbnailLink),
  };
}

/**
 * One Drive call returns the subfolders AND the media for a folder.
 * There is no database: Drive is the index.
 */
export async function listFolder(folderId: string, skipCache = false): Promise<Entry[]> {
  if (!skipCache) {
    const hit = listCache.get(folderId);
    if (hit) return hit;
  }

  const entries: Entry[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive().files.list({
      q: `'${folderId}' in parents and trashed = false`,
      // Folders first, then newest media. Drive sorts server-side so we do not have to.
      orderBy: "folder,createdTime desc",
      pageSize: 200,
      pageToken,
      fields:
        "nextPageToken, files(id,name,mimeType,createdTime,thumbnailLink," +
        "imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis))",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const f of res.data.files ?? []) {
      if (!f.id) continue;
      entries.push(toEntry(f));
      if (f.mimeType === FOLDER_MIME) {
        nodeCache.set(f.id, { name: f.name ?? "Untitled", parent: folderId });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  listCache.set(folderId, entries);
  return entries;
}

async function node(id: string): Promise<{ name: string; parent: string | null }> {
  const hit = nodeCache.get(id);
  if (hit) return hit;

  const res = await drive().files.get({
    fileId: id,
    fields: "id,name,parents",
    supportsAllDrives: true,
  });
  const value = { name: res.data.name ?? "Untitled", parent: res.data.parents?.[0] ?? null };
  nodeCache.set(id, value);
  return value;
}

/**
 * Walks up to the library root, which doubles as the security check:
 * a folder ID that does not descend from the root is rejected, so nobody
 * can browse the rest of the owner's Drive by guessing IDs.
 */
export async function breadcrumbs(folderId: string): Promise<Crumb[]> {
  const root = rootId();
  if (folderId === root) return [];

  const trail: Crumb[] = [];
  let cursor: string | null = folderId;

  for (let depth = 0; cursor && depth < 20; depth++) {
    if (cursor === root) return trail;
    const n: { name: string; parent: string | null } = await node(cursor);
    trail.unshift({ id: cursor, name: n.name });
    cursor = n.parent;
  }

  throw new Error("That folder is not inside the library");
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */
export async function createFolder(name: string, parentId: string): Promise<Entry> {
  const res = await drive().files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id,name,mimeType,createdTime",
    supportsAllDrives: true,
  });
  listCache.drop(parentId);
  return toEntry(res.data);
}

/** The browser PUTs bytes straight to this URL. Nothing large touches Cloud Run. */
export async function createUploadSession(opts: {
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
}): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.mimeType,
        "X-Upload-Content-Length": String(opts.size),
      },
      body: JSON.stringify({ name: opts.name, parents: [opts.parentId] }),
    },
  );
  if (!res.ok) throw new Error(`Drive refused the upload session: ${res.status} ${await res.text()}`);
  const location = res.headers.get("location");
  if (!location) throw new Error("Drive returned no resumable session URL");
  return location;
}

export function invalidate(folderId: string) {
  listCache.drop(folderId);
}

/* ------------------------------------------------------------------ */
/* Thumbnails                                                          */
/* ------------------------------------------------------------------ */
/**
 * Drive renders thumbnails for photos AND videos already, at any size we ask for.
 * Using them means no image library, no bucket and no worker queue.
 * Returns null while Drive is still generating one for a fresh upload.
 */
export async function thumbnail(fileId: string, width: number): Promise<{ body: ArrayBuffer; type: string } | null> {
  let link = thumbCache.get(fileId);

  if (!link) {
    const meta = await drive().files.get({
      fileId,
      fields: "thumbnailLink",
      supportsAllDrives: true,
    });
    if (!meta.data.thumbnailLink) return null;
    link = meta.data.thumbnailLink;
    thumbCache.set(fileId, link);
  }

  const url = link.replace(/=s\d+$/, "").replace(/=w\d+.*$/, "") + `=w${width}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) return null;

  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/jpeg" };
}

export async function mimeOf(fileId: string): Promise<string> {
  const res = await drive().files.get({ fileId, fields: "mimeType", supportsAllDrives: true });
  return res.data.mimeType ?? "application/octet-stream";
}
