export type Entry = {
  id: string;
  name: string;
  kind: "folder" | "photo" | "video";
  width: number | null;
  height: number | null;
  durationLabel: string | null;
  /** EXIF capture time when Drive has it (photos only), else Drive's own createdTime. Despite the name, this is "best known date", used for both display and sort order. */
  createdTime: string;
  hasThumb: boolean;
  /** Drive's own star, reused as this app's "favourite" — same flag Drive's own UI shows. */
  starred: boolean;
  /** Only set on search results and favourites — the folder path leading to this item, for context outside its normal listing. */
  path?: string;
  /** Only set on search results and favourites — needed there (and only there) to invalidate the right folder's cache on delete/rename/unfavourite. */
  parentId?: string;
  /** Folder-only — id of the photo/video chosen as this folder's cover tile, if one was set. */
  coverId?: string;
};

export type Crumb = { id: string; name: string };

export type BrowseResponse = {
  folderId: string;
  crumbs: Crumb[];
  entries: Entry[];
};

export type SearchResponse = {
  query: string;
  results: Entry[];
};

export type FavoritesResponse = {
  results: Entry[];
};

/* ------------------------------------------------------------------ */
/* Money — one pooled pot, no split-and-settle                         */
/* ------------------------------------------------------------------ */
export const MONEY_TX_TYPES = ["income", "expense", "saving", "transfer"] as const;
export type MoneyTxType = (typeof MONEY_TX_TYPES)[number];

export const MONEY_MODES = ["upi", "card", "cash", "bank_transfer"] as const;
export type MoneyMode = (typeof MONEY_MODES)[number];

export type MoneyCategory = {
  id: string;
  name: string;
  group: string;
  type: MoneyTxType;
  order: number;
  archived: boolean;
  /** How many transactions have used this category — drives the quick-add grid's "most used first" ordering. */
  useCount: number;
};

export type MoneyTx = {
  id: string;
  type: MoneyTxType;
  amountPaise: number;
  date: string; // yyyy-mm-dd
  /** Computed server-side from date + money_settings.monthStartDay — the client never sets this. */
  monthKey: string; // yyyy-mm
  categoryId: string;
  note: string;
  mode?: MoneyMode;
  paidBy: string; // email — recorded for context only, never drives balances (one pooled pot)
  tags: string[];
  source: "manual" | "recurring";
  /** Set when this entry was posted from a recurring template ("Post this month"). */
  recurringId?: string;
  createdBy: string; // email
  createdAt: number;
  updatedAt: number;
};

export type MoneyMonthSummary = {
  monthKey: string;
  incomePaise: number;
  expensePaise: number;
  savingPaise: number;
  surplusPaise: number; // income - expense - saving, this month alone
  carryInPaise: number; // previous month's leftPaise (or opening balance for the first month ever)
  leftPaise: number; // carryInPaise + surplusPaise
  byGroup: Record<string, number>;
  byCategory: Record<string, number>;
  byMode: Record<string, number>;
  txCount: number;
  updatedAt: number;
};

export type MoneySettings = {
  monthStartDay: number; // default 1
  currency: "INR";
  openingBalancePaise: number;
  updatedAt: number;
};

export type MoneyBudget = {
  monthKey: string;
  byGroup: Record<string, number>;
  byCategory?: Record<string, number>;
};

export type MoneyDashboardResponse = {
  monthKey: string;
  isCurrentMonth: boolean;
  prevMonthKey: string;
  prevMonthLabel: string;
  prevMonthExpensePaise: number;
  prevByCategory: Record<string, number>;
  summary: MoneyMonthSummary;
  budget: MoneyBudget;
  recent: MoneyTx[];
  topExpenses: MoneyTx[];
  safeToSpendPerDayPaise: number | null;
};

export type MoneyCategoriesResponse = { items: MoneyCategory[] };
export type MoneyTxListResponse = { items: MoneyTx[]; nextCursor: string | null };

/** A template you tap "Post this month" on instead of typing rent/EMI/SIP from scratch each time. No auto-posting yet — every post is a manual, one-tap trigger. */
export type MoneyRecurring = {
  id: string;
  name: string;
  type: MoneyTxType;
  amountPaise: number;
  categoryId: string;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};
export type MoneyRecurringResponse = { items: MoneyRecurring[] };

export type MoneyGoal = {
  id: string;
  name: string;
  targetPaise: number;
  savedPaise: number;
  createdAt: number;
  updatedAt: number;
};
export type MoneyGoalsResponse = { items: MoneyGoal[] };

/** Seeded into money_categories the first time the categories endpoint runs on an empty collection. */
export const MONEY_SEED_CATEGORIES: { name: string; group: string; type: MoneyTxType }[] = (() => {
  const income = ["Salary", "Freelance / side income", "Interest & dividends", "Refunds & cashback", "Gifts received", "Other income"];
  const expenseGroups: Record<string, string[]> = {
    Housing: ["Rent", "Society maintenance", "Repairs & upkeep"],
    "Groceries & household": ["Groceries", "Vegetables & fruits", "Milk & daily needs", "Household supplies"],
    "Food & dining": ["Dining out", "Food delivery", "Snacks & coffee"],
    "Utilities & recharges": ["Electricity", "Water", "Cooking gas", "Broadband", "Mobile recharge"],
    Transport: ["Fuel", "Cab / auto", "Metro / bus / train", "Vehicle service", "Parking & tolls"],
    "EMIs & loans": ["Home loan EMI", "Vehicle loan EMI", "Personal loan EMI", "Card interest & late fees"],
    Insurance: ["Health", "Term life", "Vehicle"],
    Health: ["Doctor", "Medicines", "Lab tests"],
    "Shopping & personal": ["Clothing", "Electronics", "Personal care & salon"],
    "Household help": ["Maid", "Cook", "Driver", "Laundry / ironing"],
    "Family & gifts": ["Support to parents", "Gifts", "Functions & weddings", "Festivals"],
    "Subscriptions & fun": ["OTT & apps", "Movies & outings", "Hobbies"],
    Travel: ["Trips", "Stays"],
    Learning: ["Courses & certifications", "Books"],
    "Donations & offerings": ["Donations & offerings"],
    "Fees & taxes": ["Income tax", "Bank charges", "Government fees"],
    Miscellaneous: ["Miscellaneous"],
  };
  const saving = ["Mutual fund SIP", "Recurring deposit", "Fixed deposit", "PPF", "NPS", "Stocks", "Gold"];
  const transfer = ["Credit card bill payment", "Own account transfer", "Cash withdrawal"];

  const out: { name: string; group: string; type: MoneyTxType }[] = [];
  income.forEach((name) => out.push({ name, group: "Income", type: "income" }));
  for (const [group, names] of Object.entries(expenseGroups)) names.forEach((name) => out.push({ name, group, type: "expense" }));
  saving.forEach((name) => out.push({ name, group: "Savings", type: "saving" }));
  transfer.forEach((name) => out.push({ name, group: "Transfers", type: "transfer" }));
  return out;
})();

/* ------------------------------------------------------------------ */
/* Net worth                                                           */
/* ------------------------------------------------------------------ */
export const WORTH_CATEGORIES = [
  "Bank", "Investment", "Property", "Gold", "Loan", "Credit card", "Other",
] as const;

export type WorthAccount = {
  id: string;
  name: string;
  kind: "asset" | "liability";
  category: string;
  value: number; // rupees, current value
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/* Lists — to-dos and groceries                                        */
/* ------------------------------------------------------------------ */
export type ListItem = { id: string; text: string; done: boolean };

export type ListDoc = {
  id: string;
  name: string;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------------------------------------------ */
/* Bills & renewals                                                    */
/* ------------------------------------------------------------------ */
export const BILL_FREQUENCIES = ["monthly", "yearly", "once"] as const;

export type Bill = {
  id: string;
  name: string;
  amount: number;
  frequency: (typeof BILL_FREQUENCIES)[number];
  nextDueDate: string; // yyyy-mm-dd
  autopay: boolean;
  notes: string;
  createdAt: number;
};

/* ------------------------------------------------------------------ */
/* Dates — birthdays, anniversaries                                    */
/* ------------------------------------------------------------------ */
export const DATE_TYPES = ["birthday", "anniversary", "other"] as const;

export type ImportantDate = {
  id: string;
  title: string;
  date: string; // yyyy-mm-dd (year is ignored for recurring)
  type: (typeof DATE_TYPES)[number];
  recurring: boolean;
  notes: string;
  createdAt: number;
};

/* ------------------------------------------------------------------ */
/* Trips                                                               */
/* ------------------------------------------------------------------ */
export const TRIP_STATUSES = ["planning", "upcoming", "past"] as const;

export type Trip = {
  id: string;
  name: string;
  destination: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  budget: number;
  notes: string;
  status: (typeof TRIP_STATUSES)[number];
  createdAt: number;
};

/* ------------------------------------------------------------------ */
/* Wishlist                                                             */
/* ------------------------------------------------------------------ */
export const WISHLIST_CATEGORIES = ["Watch", "Eat", "Buy", "Other"] as const;

export type WishlistItem = {
  id: string;
  title: string;
  url: string;
  price: number | null;
  category: string;
  notes: string;
  done: boolean;
  addedBy: string;
  createdAt: number;
};

/* ------------------------------------------------------------------ */
/* Vehicles                                                             */
/* ------------------------------------------------------------------ */
export type VehicleLog = {
  id: string;
  date: string; // yyyy-mm-dd
  kind: "fuel" | "service";
  odometer: number | null;
  amount: number;
  notes: string;
};

export type Vehicle = {
  id: string;
  name: string;
  regNumber: string;
  logs: VehicleLog[];
  createdAt: number;
};

/* ------------------------------------------------------------------ */
/* Emergency card — one document, meant to work even offline           */
/* ------------------------------------------------------------------ */
export type EmergencyContact = { id: string; name: string; relation: string; phone: string };

export type EmergencyCard = {
  bloodType: { vamsi: string; partner: string };
  allergies: string;
  address: string;
  contacts: EmergencyContact[];
  doctor: string;
  insurance: string;
  updatedAt: number;
};
