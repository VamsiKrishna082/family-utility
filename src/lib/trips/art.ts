/**
 * Illustrated trip covers: a scene picked from the destination's name, drawn
 * as SVG so it's crisp and fills any shape (phone, laptop, print). Pure —
 * tested in scripts/trips.test.mjs.
 */
export const ART_THEMES = ["beach", "mountains", "desert", "city"] as const;
export type ArtTheme = (typeof ART_THEMES)[number];
export const ART_LABEL: Record<ArtTheme, string> = { beach: "Beach", mountains: "Mountains", desert: "Desert", city: "City" };

const WORDS: Record<Exclude<ArtTheme, "city">, string[]> = {
  beach: [
    "beach", "coast", "island", "sea", "bay", "goa", "gokarna", "varkala", "kovalam", "pondicherry", "puducherry", "andaman",
    "havelock", "lakshadweep", "alibaug", "diu", "digha", "puri", "vizag", "visakhapatnam", "mahabalipuram", "kanyakumari",
    "rameswaram", "maldives", "bali", "phuket", "krabi", "koh", "langkawi", "boracay", "mauritius", "seychelles", "zanzibar",
    "hawaii", "maui", "cancun", "santorini", "mykonos", "ibiza", "halong", "nha trang", "da nang", "phu quoc", "sri lanka",
    "bentota", "galle", "fiji", "caribbean", "miami", "gold coast", "alleppey", "kerala",
  ],
  mountains: [
    "mountain", "hill", "valley", "peak", "trek", "himalaya", "manali", "shimla", "kasol", "spiti", "ladakh", "leh", "kashmir",
    "srinagar", "gulmarg", "pahalgam", "sonamarg", "munnar", "ooty", "kodaikanal", "coorg", "chikmagalur", "wayanad", "darjeeling",
    "gangtok", "sikkim", "shillong", "meghalaya", "tawang", "mussoorie", "nainital", "rishikesh", "auli", "dharamshala",
    "mcleodganj", "kedarnath", "badrinath", "uttarakhand", "himachal", "lonavala", "mahabaleshwar", "yercaud", "nepal", "kathmandu",
    "pokhara", "bhutan", "thimphu", "paro", "switzerland", "swiss", "interlaken", "zermatt", "alps", "austria", "norway", "iceland",
    "banff", "sapa", "ha giang", "patagonia", "new zealand", "queenstown", "tibet",
  ],
  desert: [
    "desert", "dune", "jaisalmer", "jodhpur", "bikaner", "rajasthan", "pushkar", "rann", "kutch", "dubai", "abu dhabi", "doha",
    "qatar", "oman", "muscat", "egypt", "cairo", "giza", "morocco", "marrakech", "sahara", "jordan", "petra", "wadi rum",
    "arizona", "las vegas", "riyadh", "saudi",
  ],
};

/** Which scene suits a destination; anything unknown is a city skyline. */
export function artTheme(destination: string, name = ""): ArtTheme {
  const text = ` ${`${destination} ${name}`.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  for (const theme of ["beach", "mountains", "desert"] as const) {
    if (WORDS[theme].some((w) => text.includes(` ${w} `) || text.includes(` ${w}s `))) return theme;
  }
  return "city";
}

/** Small deterministic random numbers from a string, so each place gets its own skyline or ridge, always the same one. */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** The words written across the art: the destination, else the trip name. */
export function artTitle(destination: string, name: string): string {
  return (destination.trim() || name.trim() || "Our trip").replace(/\s+/g, " ");
}
