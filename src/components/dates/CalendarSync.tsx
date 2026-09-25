"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { fetcher, Modal, send } from "@/components/dates/shared";
import type { DtCalendarLinkResponse } from "@/lib/dates/types";

/**
 * Reminders without a push-notification server: subscribe your phone's own
 * calendar to a private feed of these dates. Each date's "Remind us" choices
 * become calendar alerts (9 AM on the day, or N days before).
 */
export function CalendarSync({ onClose }: { onClose: () => void }) {
  const { data, mutate } = useSWR<DtCalendarLinkResponse>("/api/dates/calendar", fetcher);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const url = data && origin ? `${origin}/share/calendar/${data.token}.ics` : "";
  const webcal = url.replace(/^https?:/, "webcal:");
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = async () => {
    const res = await send<DtCalendarLinkResponse>("/api/dates/calendar", "POST");
    mutate(res, false);
    setConfirmReset(false);
  };

  return (
    <Modal title="Calendar sync" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ fontSize: 14, color: "var(--dim)" }}>
          Add these dates to your phone&apos;s calendar once, and you&apos;ll get a reminder for every birthday and anniversary — new dates show up automatically.
        </p>
        {isLocal && (
          <p style={{ fontSize: 12.5, color: "var(--amber)" }}>
            This is the local dev server — Google can&apos;t reach it. Open Calendar sync from the live site to subscribe.
          </p>
        )}

        <a className="btn btn-dark text-center" href={url ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : undefined} target="_blank" rel="noreferrer">
          Add to Google Calendar
        </a>
        <a className="btn btn-plain text-center" href={webcal || undefined}>Add to iPhone / Mac Calendar</a>
        <a className="btn btn-plain flex items-center justify-center gap-1.5" href={url ? `${url}?download=1` : undefined}>
          <Download size={15} /> Download .ics file
        </a>

        <div>
          <p style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Private link</p>
          <div className="flex" style={{ gap: 8 }}>
            <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0, borderRadius: 10, border: "1px solid var(--line)", padding: "9px 12px", fontSize: 12.5, color: "var(--dim)" }} aria-label="Calendar feed link" />
            <button className="btn btn-plain" onClick={copy} disabled={!url} aria-label="Copy link">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>
            Anyone with this link can see your dates. Google refreshes subscribed calendars every few hours.
          </p>
        </div>

        {confirmReset ? (
          <div className="flex items-center" style={{ gap: 8, fontSize: 13 }}>
            <span style={{ color: "var(--dim)", flex: 1 }}>The old link stops working — you&apos;ll need to add the calendar again.</span>
            <button className="btn btn-plain" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn-dark" onClick={reset}>Reset</button>
          </div>
        ) : (
          <button className="flex items-center" style={{ gap: 6, fontSize: 13, color: "var(--faint)" }} onClick={() => setConfirmReset(true)}>
            <RefreshCw size={13} /> Reset the private link
          </button>
        )}
      </div>
    </Modal>
  );
}
