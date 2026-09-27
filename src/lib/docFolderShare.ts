import { db } from "@/lib/firestore";
import { descendants, folderPath } from "@/lib/docFolders";
import type { DocFolder, DocFolderShare, DocRecord } from "@/lib/types";

/**
 * Folder share links: /share/folder/<token>. Deliberately public, so every
 * request re-checks the token (exists, not revoked, not expired) and only
 * ever reaches documents inside the shared folder tree.
 */
export async function folderShareByToken(token: string): Promise<DocFolderShare | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const snap = await db().collection("doc_folder_shares").doc(token).get();
  if (!snap.exists) return null;
  const share = snap.data() as DocFolderShare;
  if (share.revoked || share.expiresAt < Date.now()) return null;
  return share;
}

export type SharedFolderDoc = { id: string; name: string; path: string; mimeType: string; sizeBytes: number; files: { driveFileId: string; name: string; sizeBytes: number; main: boolean }[] };

/** Every live document in the shared folder and its sub-folders, grouped by folder path (relative to the shared folder). */
export async function sharedFolderContents(share: DocFolderShare): Promise<{ folderName: string; docs: SharedFolderDoc[] }> {
  const folders = (await db().collection("doc_folders").get()).docs.map((d) => d.data() as DocFolder);
  const inside = descendants(folders, share.folderId);
  const root = folders.find((f) => f.id === share.folderId);
  const rootPath = folderPath(folders, share.folderId);
  const ids = [...inside];
  const snaps = await Promise.all(
    // Firestore "in" takes up to 30 values per query.
    Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => db().collection("doc_records").where("folderId", "in", ids.slice(i * 30, i * 30 + 30)).get()),
  );
  const docs = snaps.flatMap((s) => s.docs.map((d) => d.data() as DocRecord))
    .filter((r) => !r.archived)
    .map((r) => {
      const full = folderPath(folders, r.folderId);
      const rel = full === rootPath ? "" : full.slice(rootPath.length + 3);
      return {
        id: r.id,
        name: r.name,
        path: rel,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        files: [
          { driveFileId: r.currentDriveFileId, name: r.name, sizeBytes: r.sizeBytes, main: true },
          ...(r.attachments ?? []).map((a) => ({ driveFileId: a.driveFileId, name: a.name, sizeBytes: a.sizeBytes, main: false })),
        ],
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
  return { folderName: root?.name ?? share.folderName, docs };
}
