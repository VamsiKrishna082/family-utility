"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/trips/types";
import { fetcher } from "@/components/trips/shared";

type DayPoint = GeoPoint & { day: number };
type MapResponse = { centre: GeoPoint | null; points: DayPoint[]; pending: number };

/**
 * Every place from the journal on one map (OpenStreetMap tiles, no key).
 * Numbered markers are the day. Places are looked up server-side a few at
 * a time and cached, so a long list fills in over a couple of visits.
 */
export function TripMap({ tripId, refreshKey }: { tripId: string; refreshKey: string }) {
  const { data } = useSWR<MapResponse>(`/api/trips/${tripId}/map?k=${encodeURIComponent(refreshKey)}`, fetcher, { revalidateOnFocus: false });

  if (!data) return <div style={{ height: 320, borderRadius: 12, background: "var(--line2)" }} />;
  return (
    <div>
      <PlacesMap points={data.points} centre={data.centre} />
      {data.points.length === 0 && <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>Add places to each day and they&apos;ll appear here.</p>}
      {data.pending > 0 && <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>Still finding {data.pending} place{data.pending === 1 ? "" : "s"} — they&apos;ll show next time you open this.</p>}
    </div>
  );
}

/**
 * The map itself, from points already looked up — used by the Journey tab
 * and by the shared/printed journal. `route` joins the places in day order
 * with a dashed line.
 */
export function PlacesMap({ points, centre, height = 320, route = false }: { points: DayPoint[]; centre: GeoPoint | null; height?: number | string; route?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([points, centre]);

  useEffect(() => {
    if (!el.current) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, zoomAnimation: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);
      if (route && points.length > 1) {
        L.polyline(points.map((p) => [p.lat, p.lon] as [number, number]), { color: "#2f6e6b", weight: 2, opacity: 0.7, dashArray: "5 6" }).addTo(map);
      }
      const markers = points.map((p) =>
        L.marker([p.lat, p.lon], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:12px;background:#2f6e6b;color:#fff;font:700 11px system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);-webkit-print-color-adjust:exact;print-color-adjust:exact">${p.day}</span>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).bindTooltip(`Day ${p.day}: ${p.name.replace(/</g, "&lt;")}`),
      );
      markers.forEach((m) => m.addTo(map!));
      if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25), { maxZoom: 13, animate: false });
      else if (centre) map.setView([centre.lat, centre.lon], 10);
      else map.setView([22.5, 79], 4); // India
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, route]);

  return <div ref={el} style={{ height, borderRadius: 12, overflow: "hidden", zIndex: 0, position: "relative" }} />;
}
