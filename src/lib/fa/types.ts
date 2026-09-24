/* ------------------------------------------------------------------ */
/* Food & activity — a daily food and movement log, per person         */
/* (spec: food.md). The unit is the day.                               */
/* ------------------------------------------------------------------ */

export const FA_MEALS = ["breakfast", "lunch", "snacks", "dinner"] as const;
export type FaMeal = (typeof FA_MEALS)[number];

export const FA_MEAL_LABEL: Record<FaMeal, string> = {
  breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks", dinner: "Dinner",
};

/** Where a food's numbers came from. 'local' is the in-app Indian dish table (IFCT-style values). */
export const FA_SOURCES = ["yours", "local", "off", "usda", "ai"] as const;
export type FaSource = (typeof FA_SOURCES)[number];

export const FA_SOURCE_LABEL: Record<FaSource, string> = {
  yours: "Yours", local: "IFCT", off: "Packaged", usda: "USDA", ai: "AI estimate",
};

export type FaStatus = "on" | "over" | "under" | "none";
export const FA_STATUS_LABEL: Record<FaStatus, string> = {
  on: "On target", over: "Over target", under: "Under target", none: "Not logged",
};

export type FaNutrition = { kcal: number; protein: number; carbs: number; fat: number; fibre: number };
export const FA_NUTRIENTS = ["kcal", "protein", "carbs", "fat", "fibre"] as const;
export type FaNutrient = (typeof FA_NUTRIENTS)[number];

/** A serving option; `mult` scales the food's base nutrition (base = 1 serving for dishes, 100 g for packaged/generic foods). */
export type FaServing = { label: string; mult: number };

/**
 * A food as returned by search. `key` is stable across sources
 * ("local:idli", "off:8901234567890", "usda:12345", "yours:<id>", "ai:<id>")
 * and is what overrides and favourites hang off.
 */
export type FaFood = {
  key: string;
  name: string;
  brand?: string;
  barcode?: string;
  source: FaSource;
  /** What the base nutrition refers to, e.g. "1 piece" or "100 g". */
  baseLabel: string;
  base: FaNutrition;
  servings: FaServing[];
  /** Set when this person has their own edited version — base already reflects it. */
  editedAt?: number;
  /** The unedited values, so "Reset" can go back to them. */
  sourceBase?: FaNutrition;
  confidence?: "low" | "medium" | "high";
  favourite?: boolean;
};

export type FaEntry = FaNutrition & {
  id: string;
  person: string;
  date: string; // YYYY-MM-DD
  meal: FaMeal;
  foodKey: string;
  name: string;
  servingLabel: string;
  qty: number;
  source: FaSource;
  edited: boolean;
  createdAt: number;
  updatedAt: number;
};

export const FA_ACTIVITIES = ["walk", "run", "cycle", "strength", "yoga", "sport", "other"] as const;
export type FaActivity = (typeof FA_ACTIVITIES)[number];
export const FA_ACTIVITY_LABEL: Record<FaActivity, string> = {
  walk: "Brisk walk", run: "Run", cycle: "Cycling", strength: "Strength", yoga: "Yoga", sport: "Sport", other: "Other",
};

export type FaDay = FaNutrition & {
  person: string;
  date: string;
  eatenKcal: number;
  burnedKcal: number;
  netKcal: number;
  entryCount: number;
  steps: number;
  stepsSource: "manual" | "device";
  workoutMin: number;
  activity?: FaActivity;
  status: FaStatus;
  targetKcal: number | null;
  proteinTargetG: number | null;
  updatedAt: number;
};

export type FaSex = "male" | "female";

export type FaProfile = {
  person: string;
  heightCm: number;
  weightKg: number;
  birthYear: number;
  sex: FaSex;
  activityFactor: number;
  deficitPct: number;
  /** Set only if the person typed their own target; never allowed below the BMR floor. */
  manualTargetKcal?: number;
  targetKcal: number;
  bmrKcal: number;
  maintenanceKcal: number;
  proteinG: number;
  fibreG: number;
  fatG: number;
  carbsG: number;
  stepGoal: number;
  remindersOn: boolean;
  updatedAt: number;
};

export type FaPerson = { id: string; name: string };

export type FaStripDay = { date: string; status: FaStatus };

export type FaPersonDay = {
  person: FaPerson;
  isYou: boolean;
  profile: FaProfile | null;
  day: FaDay | null;
  entries: FaEntry[];
  strip14: FaStripDay[];
  loggingStreak: number;
  daysLogged: number;
  onTarget7: number;
  onTarget14: number;
  proteinHit7: number;
  avgProtein7: number;
  stepsWeek: number;
  /** Mean of the last 7 days that had steps entered — the one-tap default for today's steps. */
  stepsDefault: number | null;
  weightAvg7: number | null;
};

export type FaDayResponse = {
  date: string;
  people: FaPersonDay[];
  loggedTogetherStreak: number;
  aiEnabled: boolean;
};

export type FaSearchResponse = { results: FaFood[]; online: boolean };

export type FaQuickResponse = {
  /** Most recent earlier day with this meal logged — the "Yesterday's lunch" chip. */
  repeat: { fromDate: string; meal: FaMeal; label: string; kcal: number; count: number } | null;
  favourites: FaFood[];
  /** Things you log often, exactly as you log them ("2 × Chapati") — one tap re-adds. */
  frequent: { label: string; entry: FaEntry }[];
};
