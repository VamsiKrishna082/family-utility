"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { installHow, installSteps, type InstallHow } from "@/lib/installHow";

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "install-dismissed";

/**
 * "Install on this phone". Chrome/Edge sometimes offer a one-tap install
 * (beforeinstallprompt) — then there's an Install button. Otherwise, and
 * always on iPhone/iPad (which have no prompt), it shows the steps for this
 * device and browser. Hidden when already running as the installed app.
 * On Home it can be dismissed; the Settings page (`always`) always shows it.
 */
export function InstallPrompt({ always = false }: { always?: boolean }) {
  const [prompt, setPrompt] = useState<BeforeInstallPrompt | null>(null);
  const [how, setHow] = useState<InstallHow | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) { setInstalled(true); return; }
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* private mode */ }
    setHow(installHow(navigator.userAgent, navigator.maxTouchPoints));
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPrompt); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (always && installed) {
    return (
      <div className="card flex items-center gap-3" style={{ padding: "12px 14px" }}>
        <img src="/icons/icon-192.png" width={40} height={40} alt="" style={{ borderRadius: 10, flexShrink: 0 }} />
        <p style={{ fontSize: 14 }}><b>Installed.</b> You're using the app from your home screen.</p>
      </div>
    );
  }
  if (!how || installed || (!always && dismissed)) return null;
  // On a computer, only show it when the browser actually offers an install.
  if (how.kind === "desktop" && !prompt && !always) return null;

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const c = await prompt.userChoice;
    if (c.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <div className={`card flex items-start gap-3${always ? "" : " mt-6"}`} style={{ padding: "12px 14px" }}>
      <img src="/icons/icon-192.png" width={40} height={40} alt="" style={{ borderRadius: 10, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 700 }}>{how.kind === "desktop" ? "Install on this computer" : "Install on this phone"}</p>
        <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>
          Opens full-screen like an app, works offline for things you've opened, and can show reminders.
        </p>
        {!prompt && <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 6 }}>{installSteps(how)}</p>}
      </div>
      {prompt && (
        <button className="btn btn-dark flex items-center gap-1.5" style={{ flexShrink: 0 }} onClick={install}>
          <Download size={15} /> Install
        </button>
      )}
      {!always && <button onClick={dismiss} aria-label="Not now" style={{ padding: 4, flexShrink: 0 }}><X size={16} color="var(--faint)" /></button>}
    </div>
  );
}
