"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog — where "Save as PDF" lives too. */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button className="btn btn-plain flex items-center gap-1.5 no-print shrink-0" onClick={() => window.print()}>
      <Printer size={15} /> {label}
    </button>
  );
}
