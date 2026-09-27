import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ReminderSettings } from "@/components/ReminderSettings";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="flex items-center justify-center card" style={{ width: 38, height: 38, borderRadius: 12 }} aria-label="Home">
          <ChevronLeft size={19} />
        </Link>
        <h1 className="display" style={{ fontSize: 30 }}>Settings</h1>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        <ReminderSettings />
        <InstallPrompt />
      </div>
    </div>
  );
}
