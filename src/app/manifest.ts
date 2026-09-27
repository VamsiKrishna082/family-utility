import type { MetadataRoute } from "next";

/** Web app manifest (served at /manifest.webmanifest) — lets the app be installed to the home screen and open full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Home — our family app",
    short_name: "Home",
    description: "Money, documents, album, trips, dates and food — ours.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f1ed",
    theme_color: "#f3f1ed",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log food", url: "/food", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Add expense", url: "/money", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Documents", url: "/docs", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Trips", url: "/trips", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
