"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/food/parts";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Camera barcode scan via the browser's BarcodeDetector (Chrome on Android,
 * recent desktop Chrome). Safari/iOS doesn't ship it, so typing the number
 * under the barcode is always available too.
 */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [typed, setTyped] = useState("");
  const [camera, setCamera] = useState<"starting" | "on" | "unsupported" | "denied">("starting");

  useEffect(() => {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const found = await detector.detect(videoRef.current);
        if (found[0]?.rawValue) {
          stopped = true;
          onCode(found[0].rawValue);
          return;
        }
      } catch {
        // frame not ready yet — keep scanning
      }
      timer = setTimeout(tick, 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
        setCamera("on");
        tick();
      })
      .catch(() => setCamera("denied"));

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  const digits = typed.replace(/\D/g, "");
  return (
    <Sheet onClose={onClose} label="Scan barcode">
      <div className="flex flex-col" style={{ gap: 14 }}>
        <h2 className="fa-serif" style={{ margin: 0, fontSize: 22 }}>Scan barcode</h2>
        {camera === "on" || camera === "starting" ? (
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 14, background: "#000", aspectRatio: "4 / 3", objectFit: "cover" }} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--fa-dim)" }}>
            {camera === "denied" ? "Camera access was blocked." : "This browser can't scan barcodes with the camera."} Type the number printed under the barcode instead.
          </p>
        )}
        <div className="flex" style={{ gap: 8 }}>
          <input
            className="fa-input flex-1"
            inputMode="numeric"
            placeholder="e.g. 8901058851427"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && digits.length >= 8 && onCode(digits)}
            aria-label="Barcode number"
          />
          <button className="fa-btn fa-btn-dark" disabled={digits.length < 8} onClick={() => onCode(digits)}>Look up</button>
        </div>
      </div>
    </Sheet>
  );
}
