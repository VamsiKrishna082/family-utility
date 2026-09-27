import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { fullTextFileIds, rootId, searchLibrary } from "@/lib/drive";
import { ok, fail } from "@/lib/http";
import { folderPath } from "@/lib/docFolders";
import { matchesAll, snippet, terms } from "@/lib/findText";
import type { DocFolder, DocRecord, MoneyCategory, MoneyTx } from "@/lib/types";
import type { DtEvent } from "@/lib/dates/types";
import type { Trip, TripDay } from "@/lib/trips/types";

export const runtime = "nodejs";

export type FindHit = {
  section: "documents" | "trips" | "money" | "dates" | "album";
  id: string;
  title: string;
  sub: string;
  url: string;
  /** Set when the words were found inside the file's text rather than its details. */
  inFile?: boolean;
};

const PER_SECTION = 8;
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const nice = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * GET /api/find?q= — one search across the app: documents (details, folder
 * path, and the text inside the files via Drive's index), trips (and every
 * day's story, places, highlight), money entries, dates and the album.
 * Each section is capped; a section that fails (e.g. Drive busy) is just
 * left out rather than failing the whole search.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    const words = terms(q);
    if (q.length < 2 || !words.length) return ok({ query: q, hits: [] });

    const safe = <T,>(p: Promise<T[]>) => p.catch((e) => { console.error("[find]", e); return [] as T[]; });
    const [docs, trips, money, dates, album] = await Promise.all([
      safe(findDocs(q, words)),
      safe(findTrips(words)),
      safe(findMoney(words)),
      safe(findDates(words)),
      safe(findAlbum(q)),
    ]);
    return ok({ query: q, hits: [...docs, ...trips, ...dates, ...money, ...album] });
  } catch (e) {
    return fail(e);
  }
}

async function findDocs(q: string, words: string[]): Promise<FindHit[]> {
  const [recSnap, folderSnap, inFiles] = await Promise.all([
    db().collection("doc_records").where("archived", "==", false).get(),
    db().collection("doc_folders").get(),
    fullTextFileIds(q).catch(() => new Set<string>()),
  ]);
  const folders = folderSnap.docs.map((d) => d.data() as DocFolder);
  const hits: (FindHit & { rank: number })[] = [];
  for (const d of recSnap.docs) {
    const r = d.data() as DocRecord;
    const path = r.folderId ? folderPath(folders, r.folderId) : "";
    const details = [r.name, r.issuer, r.refNumberMasked, r.notes, path, ...(r.tags ?? []), ...(r.attachments ?? []).map((a) => a.name)].filter(Boolean).join(" ");
    const files = [r.currentDriveFileId, ...(r.versions ?? []).map((v) => v.driveFileId), ...(r.attachments ?? []).map((a) => a.driveFileId)];
    const byDetails = matchesAll(details, words);
    const byContent = !byDetails && files.some((f) => inFiles.has(f));
    if (!byDetails && !byContent) continue;
    hits.push({
      section: "documents",
      id: r.id,
      title: r.name,
      sub: [path, r.expiryDate ? `expires ${nice(r.expiryDate)}` : "", byContent ? "found in the file's text" : ""].filter(Boolean).join(" · "),
      url: `/docs/${r.id}`,
      ...(byContent ? { inFile: true } : {}),
      rank: byDetails ? 0 : 1,
    });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title)).slice(0, PER_SECTION).map(({ rank: _r, ...h }) => h);
}

async function findTrips(words: string[]): Promise<FindHit[]> {
  const [tripSnap, daySnap] = await Promise.all([db().collection("trips").get(), db().collectionGroup("days").get()]);
  const trips = new Map(tripSnap.docs.map((d) => [d.id, d.data() as Trip]));
  const hits: FindHit[] = [];
  for (const t of trips.values()) {
    if (matchesAll(`${t.name} ${t.destination ?? ""} ${t.notes ?? ""}`, words)) {
      hits.push({ section: "trips", id: t.id, title: t.name, sub: [t.destination, t.startDate ? nice(t.startDate) : "someday"].filter(Boolean).join(" · "), url: `/trips/${t.id}` });
    }
  }
  for (const d of daySnap.docs) {
    const day = d.data() as TripDay;
    const trip = trips.get(day.tripId);
    if (!trip || day.day > trip.days) continue;
    const text = [day.title, day.story, (day.places ?? []).join(", "), day.highlight, (day.food ?? []).map((f) => `${f.name} ${f.dish ?? ""}`).join(" ")].filter(Boolean).join(" · ");
    if (!matchesAll(text, words)) continue;
    hits.push({
      section: "trips",
      id: `${trip.id}:${day.day}`,
      title: `${trip.name} — Day ${day.day}${day.title ? `: ${day.title}` : ""}`,
      sub: snippet(text, words),
      url: `/trips/${trip.id}#trip-day-${day.day}`,
    });
  }
  return hits.slice(0, PER_SECTION);
}

async function findMoney(words: string[]): Promise<FindHit[]> {
  const [txSnap, catSnap] = await Promise.all([
    db().collection("money_tx").select("id", "type", "amountPaise", "date", "categoryId", "subcategory", "note", "monthKey").get(),
    db().collection("money_categories").get(),
  ]);
  const cats = new Map(catSnap.docs.map((d) => [d.id, d.data() as MoneyCategory]));
  return txSnap.docs
    .map((d) => d.data() as MoneyTx)
    .filter((t) => matchesAll(`${t.note ?? ""} ${t.subcategory ?? ""} ${cats.get(t.categoryId)?.name ?? ""}`, words))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PER_SECTION)
    .map((t) => ({
      section: "money" as const,
      id: t.id,
      title: `${t.type === "expense" ? "" : t.type === "income" ? "Income · " : "Saving · "}${rupees(t.amountPaise)} — ${t.note || t.subcategory || cats.get(t.categoryId)?.name || "entry"}`,
      sub: [nice(t.date), cats.get(t.categoryId)?.name, t.subcategory].filter(Boolean).join(" · "),
      url: `/money/category/${t.categoryId}?month=${t.monthKey}`,
    }));
}

async function findDates(words: string[]): Promise<FindHit[]> {
  const snap = await db().collection("dates").get();
  return snap.docs
    .map((d) => d.data() as DtEvent)
    .filter((e) => matchesAll(`${e.title} ${e.person ?? ""} ${e.relation ?? ""} ${e.notes ?? ""} ${(e.giftIdeas ?? []).join(" ")}`, words))
    .slice(0, PER_SECTION)
    .map((e) => ({
      section: "dates" as const,
      id: e.id,
      title: e.title,
      sub: new Date(2000, e.month - 1, e.day).toLocaleDateString("en-IN", { day: "numeric", month: "long" }),
      url: `/dates#${e.id}`,
    }));
}

async function findAlbum(q: string): Promise<FindHit[]> {
  const entries = await searchLibrary(q, rootId());
  return entries.slice(0, PER_SECTION).map((e) => ({
    section: "album" as const,
    id: e.id,
    title: e.name,
    sub: [e.kind === "folder" ? "Folder" : e.kind === "video" ? "Video" : "Photo", e.path].filter(Boolean).join(" · "),
    url: e.kind === "folder" ? `/album?folder=${e.id}` : e.parentId ? `/album?folder=${e.parentId}&open=${e.id}` : "/album",
  }));
}
