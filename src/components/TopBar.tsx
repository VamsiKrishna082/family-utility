import Link from "next/link";
import { Settings } from "lucide-react";
import { SearchPalette } from "@/components/SearchPalette";
import { signOut } from "@/lib/auth";

export function TopBar({ email }: { email: string }) {
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div
      className="flex items-center justify-between px-5 md:px-10 py-4"
      style={{ borderBottom: "1px solid var(--line)", background: "var(--card)" }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span style={{ width: 9, height: 9, borderRadius: 9, background: "var(--green)" }} />
        <span className="display" style={{ fontSize: 16.5 }}>Home</span>
      </Link>

      <div className="flex items-center gap-3">
        <SearchPalette />
        <Link href="/settings" aria-label="Settings — reminders and install" title="Settings" className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, color: "var(--faint)" }}>
          <Settings size={18} />
        </Link>
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: "var(--amber)", color: "#fff", fontSize: 13, fontWeight: 700 }}
          title={email}
        >
          {initial}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button type="submit" style={{ color: "var(--faint)", fontSize: 13 }}>Sign out</button>
        </form>
      </div>
    </div>
  );
}
