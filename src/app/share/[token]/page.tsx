import { validateShareToken } from "@/lib/docShare";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await validateShareToken(token);

  if (!valid) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card" style={{ padding: 32, textAlign: "center", maxWidth: 360 }}>
          <p className="display" style={{ fontSize: 22, marginBottom: 8 }}>Link not available</p>
          <p style={{ color: "var(--dim)", fontSize: 14 }}>This link has expired, been revoked, or never existed.</p>
        </div>
      </div>
    );
  }

  const { record } = valid;
  const fileUrl = `/share/${token}/file`;
  const isPdf = record.mimeType === "application/pdf";
  const isImage = record.mimeType.startsWith("image/");

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        <p className="display" style={{ fontSize: 22, marginBottom: 4 }}>{record.name}</p>
        <p style={{ color: "var(--faint)", fontSize: 13, marginBottom: 16 }}>Shared securely from a household document library — view or download only.</p>

        <div className="card" style={{ overflow: "hidden", minHeight: 400 }}>
          {isPdf ? (
            <iframe src={fileUrl} title={record.name} style={{ width: "100%", height: "80vh", border: "none", display: "block" }} />
          ) : isImage ? (
            <img src={fileUrl} alt={record.name} style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 16 }}>This file type can&apos;t be previewed here.</p>
            </div>
          )}
        </div>

        <a href={fileUrl} download className="btn btn-dark" style={{ display: "inline-block", marginTop: 16 }}>
          Download
        </a>
      </div>
    </div>
  );
}
