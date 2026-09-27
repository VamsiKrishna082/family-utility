"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Loads one image, retrying a couple of times if the server was busy. */
async function load(img: HTMLImageElement): Promise<boolean> {
  img.loading = "eager";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await img.decode();
      return true;
    } catch {
      if (attempt === 3) return false;
      await wait(1500 * (attempt + 1));
      const url = new URL(img.src);
      url.searchParams.set("retry", String(attempt + 1));
      img.src = url.toString();
    }
  }
  return false;
}

/**
 * Opens the browser's print dialog — where "Save as PDF" lives too. Photos
 * further down the page load lazily, so first make every image load and wait
 * for them; otherwise they'd print as blank boxes.
 */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [missing, setMissing] = useState(0);
  const print = async () => {
    const pending = [...document.querySelectorAll("img")].filter((img) => !img.complete || img.naturalWidth === 0);
    if (pending.length) {
      let done = 0;
      setLoading({ done, total: pending.length });
      const results = await Promise.all(pending.map((img) => load(img).finally(() => setLoading({ done: ++done, total: pending.length }))));
      setMissing(results.filter((ok) => !ok).length);
      setLoading(null);
    }
    window.print();
  };
  return (
    <div className="no-print shrink-0" style={{ textAlign: "right" }}>
      <button className="btn btn-plain flex items-center gap-1.5" onClick={print} disabled={!!loading}>
        <Printer size={15} /> {loading ? `Loading photos ${loading.done}/${loading.total}…` : label}
      </button>
      {missing > 0 && <p style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{missing} photo{missing === 1 ? "" : "s"} couldn&apos;t load — try again.</p>}
    </div>
  );
}
