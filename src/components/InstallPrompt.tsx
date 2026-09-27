"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "install-dismissed";

/**
 * "Install on this phone" — Chrome/Edge/Android offer a real install prompt
 * (beforeinstallprompt); iPhone Safari has none, so it shows the two taps
 * instead. Hidden once installed (running standalone) or dismissed.
 */
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* private mode */ }
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPrompt); setHidden(false); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };

  return (
    <div className="card flex items-center gap-3 mt-6" style={{ padding: "12px 14px" }}>
      <img src="/icons/icon-192.png" width={40} height={40} alt="" style={{ borderRadius: 10, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 700 }}>Install on this phone</p>
        <p style={{ fontSize: 12.5, color: "var(--faint)" }}>
          {ios
            ? <>Tap <Share size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> Share, then “Add to Home Screen”. Opens full-screen, works offline, and can show reminders.</>
            : "Opens full-screen like an app, works offline for things you've opened, and can show reminders."}
        </p>
      </div>
      {prompt && (
        <button className="btn btn-dark flex items-center gap-1.5" style={{ flexShrink: 0 }} onClick={async () => { await prompt.prompt(); const c = await prompt.userChoice; if (c.outcome === "accepted") setHidden(true); setPrompt(null); }}>
          <Download size={15} /> Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Not now" style={{ padding: 4, flexShrink: 0 }}><X size={16} color="var(--faint)" /></button>
    </div>
  );
}
