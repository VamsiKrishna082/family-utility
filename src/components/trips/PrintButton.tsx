"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

/**
 * Opens the browser's print dialog — where "Save as PDF" lives too. Photos
 * further down the page load lazily, so first make every image load and wait
 * for them; otherwise they'd print as blank boxes.
 */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const print = async () => {
    const imgs = [...document.querySelectorAll("img")];
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length) {
      let done = 0;
      setLoading({ done, total: pending.length });
      await Promise.all(pending.map((img) => {
        img.loading = "eager";
        return img.decode().catch(() => undefined).finally(() => setLoading({ done: ++done, total: pending.length }));
      }));
      setLoading(null);
    }
    window.print();
  };
  return (
    <button className="btn btn-plain flex items-center gap-1.5 no-print shrink-0" onClick={print} disabled={!!loading}>
      <Printer size={15} /> {loading ? `Loading photos ${loading.done}/${loading.total}…` : label}
    </button>
  );
}
