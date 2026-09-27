import type { Metadata } from "next";
import { FileText, Folder, Paperclip } from "lucide-react";
import { folderShareByToken, sharedFolderContents } from "@/lib/docFolderShare";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared documents", robots: { index: false, follow: false } };

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/**
 * Read-only view of a shared Documents folder: every document in it and its
 * sub-folders, each file openable until the link expires or is revoked.
 */
export default async function SharedFolderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await folderShareByToken(token);
  if (!share) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: 26 }}>This link has expired</h1>
        <p style={{ color: "var(--dim)", marginTop: 8 }}>It may have been turned off, or its time ran out. Ask for a new one.</p>
      </main>
    );
  }
  const { folderName, docs } = await sharedFolderContents(share);
  const groups = new Map<string, typeof docs>();
  for (const d of docs) groups.set(d.path, [...(groups.get(d.path) ?? []), d]);
  const file = (id: string) => `/share/folder/${token}/file/${id}`;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 60px" }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--faint)" }}>Shared documents</p>
      <h1 className="display flex items-center gap-2" style={{ fontSize: 32, marginTop: 4 }}><Folder size={26} /> {folderName}</h1>
      <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 6 }}>
        {docs.length} document{docs.length === 1 ? "" : "s"} · this link works until {new Date(share.expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
      </p>
      {docs.length === 0 && <p style={{ color: "var(--faint)", marginTop: 30 }}>This folder is empty.</p>}
      {[...groups.entries()].map(([path, list]) => (
        <section key={path || "root"} className="card" style={{ padding: 16, marginTop: 18 }}>
          {path && <p className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: "var(--dim)", marginBottom: 6 }}><Folder size={14} /> {path}</p>}
          {list.map((d) => (
            <div key={d.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line2)" }}>
              {d.files.map((f) => (
                <a key={f.driveFileId} href={file(f.driveFileId)} target="_blank" rel="noreferrer" className="flex items-center gap-2" style={{ padding: f.main ? "2px 0" : "2px 0 2px 22px", fontSize: f.main ? 14.5 : 13 }}>
                  {f.main ? <FileText size={16} color="var(--faint)" /> : <Paperclip size={13} color="var(--faint)" />}
                  <span className="flex-1 min-w-0 truncate" style={{ fontWeight: f.main ? 600 : 400 }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: "var(--faint)", flexShrink: 0 }}>{size(f.sizeBytes)}</span>
                </a>
              ))}
            </div>
          ))}
        </section>
      ))}
      <p style={{ marginTop: 40, fontSize: 12, color: "var(--faint)", textAlign: "center" }}>Shared privately from our family app.</p>
    </main>
  );
}
