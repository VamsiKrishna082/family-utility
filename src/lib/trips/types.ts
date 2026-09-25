/* ------------------------------------------------------------------ */
/* Trips — one record from idea → plan → journey → memory.             */
/* Plan (itinerary, stays, links, to-dos, budget, bookings, packing),  */
/* Journey (a journal per day with Album photos and places),           */
/* Expenses (Money transactions linked by tripId + shared costs).      */
/* ------------------------------------------------------------------ */

export const TRIP_BOOKING_KINDS = ["flight", "train", "bus", "car", "stay", "activity", "other"] as const;
export type TripBookingKind = (typeof TRIP_BOOKING_KINDS)[number];
export const TRIP_BOOKING_LABEL: Record<TripBookingKind, string> = {
  flight: "Flight", train: "Train", bus: "Bus", car: "Car / cab", stay: "Stay", activity: "Activity", other: "Other",
};

export type TripBooking = {
  id: string;
  kind: TripBookingKind;
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  confirmation?: string;
  link?: string;
  notes?: string;
};

export type TripPackItem = { id: string; text: string; done: boolean };

export const PLAN_STATUSES = ["idea", "booked", "done"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Something you plan to do — on a day, or unscheduled (day unset). */
export type PlanItem = {
  id: string;
  day?: number;
  time?: string; // HH:MM
  title: string;
  place?: string;
  link?: string;
  notes?: string;
  estimateRupees?: number;
  /** How long it takes, for spotting clashes on the timeline. */
  durationMin?: number;
  status: PlanStatus;
  /** Person ids (vamsi / varshini) who 👍 it. */
  votes?: string[];
};

export const STAY_STATUSES = ["option", "shortlisted", "booked"] as const;
export type StayStatus = (typeof STAY_STATUSES)[number];

export type StayOption = {
  id: string;
  name: string;
  link?: string;
  area?: string;
  pricePerNightRupees?: number;
  nights?: number;
  rating?: number; // 1–5, your own
  pros?: string;
  cons?: string;
  status: StayStatus;
  votes?: string[];
};

export type TripLink = { id: string; title: string; url: string; note?: string };
export type TripTodo = { id: string; text: string; due?: string; done: boolean };

export const BUDGET_KEYS = ["travel", "stay", "food", "activities", "shopping", "other"] as const;
export type BudgetKey = (typeof BUDGET_KEYS)[number];
export const BUDGET_LABEL: Record<BudgetKey, string> = {
  travel: "Travel", stay: "Stay", food: "Food", activities: "Activities", shopping: "Shopping", other: "Other",
};

/** A cost shared with people outside the household (friends on the trip) — kept on the trip, not in Money. */
export type SharedCost = {
  id: string;
  date?: string;
  title: string;
  /** In the trip's currency when set, else rupees. */
  amount: number;
  paidBy: string; // a traveller name
  splitAmong: string[]; // traveller names
};

export type GeoPoint = { name: string; lat: number; lon: number };

/** A recorded "X paid Y back" — reduces what the settle-up still shows. */
export type Settlement = { id: string; from: string; to: string; amount: number; date: string };

/** Cash / forex log: money taken out or exchanged ("in") and cash spent ("out"), per currency. */
export type CashEntry = { id: string; date: string; kind: "in" | "out"; amount: number; currency: string; inrCost?: number; note?: string };

/** A receipt photo stored for the trip (GCS), optionally tied to one expense or shared cost. */
export type TripReceipt = { id: string; key: string; name: string; contentType: string; txId?: string; sharedId?: string; uploadedAt: number; uploadedBy: string };

export type Trip = {
  id: string;
  name: string;
  destination: string;
  /** Unset while it's only an idea — no dates yet. */
  startDate?: string;
  /** Number of days; endDate is derived (start + days − 1). */
  days: number;
  endDate?: string;
  /** Names; "Us" is the two of you. Used by shared costs. */
  travellers: string[];
  budgetRupees?: number;
  budgetPlan: Partial<Record<BudgetKey, number>>;
  notes: string;
  coverPhotoId?: string;
  albumFolderId?: string;
  /** Foreign trips: shared costs can be entered in this currency and converted at `rate` rupees per unit. */
  currency?: string;
  rate?: number;
  bookings: TripBooking[];
  packing: TripPackItem[];
  plan: PlanItem[];
  stays: StayOption[];
  links: TripLink[];
  todos: TripTodo[];
  shared: SharedCost[];
  settlements: Settlement[];
  /** UPI ids per traveller name, for "pay me" links in settle-up messages. */
  upi: Record<string, string>;
  cash: CashEntry[];
  receipts: TripReceipt[];
  /** Destination coordinates (for weather + map centre), looked up once. */
  geo?: GeoPoint;
  /** Private read-only journal link token, when sharing is on. */
  shareToken?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

/** trips/{tripId}/days/{dayNumber} — one per day, so the two of you can write different days at once. */
export type TripDay = {
  tripId: string;
  day: number; // 1-based
  title: string;
  story: string;
  places: string[];
  /** Map positions for `places`, looked up when they're saved. */
  placeGeo?: GeoPoint[];
  highlight: string;
  folderId?: string;
  folderName?: string;
  /** How the day felt (an emoji) and a 1–5 rating — the wrap-up's "best day" comes from these. */
  mood?: string;
  rating?: number;
  /** Traveller names who were there (group trips); empty = everyone. */
  who?: string[];
  food?: FoodNote[];
  /** Up to 4 favourite photo ids — shown first on the shared journal. */
  favourites?: string[];
  voice?: VoiceNote[];
  updatedAt: number;
  updatedBy: string;
};

export type FoodNote = { id: string; name: string; dish?: string; rating?: number; goBack?: boolean };
export type VoiceNote = { id: string; key: string; contentType: string; durationSec: number; createdAt: number; by: string };

export type TripStatus = "idea" | "upcoming" | "ongoing" | "completed";

export type TripSummary = Trip & { spentPaise: number; expenseCount: number };
export type TripsResponse = { items: TripSummary[] };

/** hiddenDays: days past the trip's length that still hold writing/photos (kept when the trip was shortened). */
export type TripDetailResponse = { trip: Trip; days: TripDay[]; hiddenDays: number[]; me: { id: string; name: string } };

export type TripExpense = {
  id: string;
  date: string;
  amountPaise: number;
  categoryId: string;
  categoryName: string;
  categoryGroup: string;
  subcategory?: string;
  note: string;
  mode?: string;
  paidBy: string;
};

/** refunds: Money income entries linked to the trip (cancellations, refunds) — they bring the net cost down. */
export type TripExpensesResponse = { items: TripExpense[]; refunds: TripExpense[] };
export type TripCandidatesResponse = { items: (TripExpense & { otherTripId?: string })[]; month: string; category: string };

export type WeatherDay = { date: string; code: number; max: number; min: number; rainPct: number };
export type TripWeatherResponse = { place: string | null; days: WeatherDay[]; note?: string };

export const PACKING_STARTER = [
  "ID cards / passports", "Tickets & bookings (offline copy)", "Phone chargers & power bank", "Medicines & first aid",
  "Toiletries", "Clothes for each day", "Sleepwear", "Comfortable shoes", "Sunglasses & sunscreen", "Cash & cards",
  "Water bottle", "Snacks for the journey",
];

export const TODO_STARTER = ["Book travel tickets", "Book stay", "Apply for leave", "Check ID / passport validity", "Arrange home & plants care"];

/** "Someday" places — not a trip yet. Convert one into a trip when it's time. */
export type TripIdea = {
  id: string;
  place: string;
  why?: string;
  bestSeason?: string;
  roughCostRupees?: number;
  days?: number;
  link?: string;
  votes?: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};
export type TripIdeasResponse = { items: TripIdea[]; me: { id: string; name: string } };

export type FolderSuggestion = { day: number; date: string; folderId: string; folderName: string; path: string; photosOnDay: number; photosTotal: number };
export type TripWrapUp = { days: number; daysWritten: number; places: number; photos: number; bestDay: number | null; moods: string[]; highlights: { day: number; text: string }[]; foodSpots: number };
export type DocCheckItem = { name: string; owner: string; expiryDate: string; problem: "expired" | "expires_during" | "under_6_months" };
