import type { Metadata } from "next";
import { Suspense } from "react";
import { HealthPage } from "@/components/HealthPage";

export const metadata: Metadata = { title: "Health" };

export default function Health() {
  return (
    <Suspense fallback={<p style={{ color: "var(--faint)", fontSize: 14 }}>Loading…</p>}>
      <HealthPage />
    </Suspense>
  );
}
