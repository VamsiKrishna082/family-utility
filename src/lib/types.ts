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

export const MONEY_MODES = ["upi", "card", "cash", "bank_transfer", "credit_card"] as const;
export type MoneyMode = (typeof MONEY_MODES)[number];

/** A credit card, for the "spent on credit card" flow — see MoneyTx.cardId. */
export type MoneyCard = {
  id: string;
  name: string;
  last4?: string;
  archived: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
};
export type MoneyCardsResponse = { items: MoneyCard[] };

/**
 * Per card: 'spentPaise' is every mode:'credit_card' transaction ever logged
 * against it (a swipe — doesn't touch expensePaise/leftover, see moneyEngine);
 * 'paidPaise' is every other transaction with this cardId set (a bill
 * payment — a normal expense that DOES touch leftover). The difference is
 * what's still owed — "bill to be paid" — not scoped to a single month,
 * since a card's balance doesn't reset at a calendar boundary.
 */
export type MoneyCreditCardSummary = {
  card: MoneyCard;
  spentPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  spentThisMonthPaise: number;
};
export type MoneyCreditCardsResponse = { cards: MoneyCreditCardSummary[]; totalOutstandingPaise: number };

export type MoneyCategory = {
  id: string;
  name: string;
  group: string;
  type: MoneyTxType;
  order: number;
  archived: boolean;
  /** How many transactions have used this category — drives the quick-add grid's "most used first" ordering. */
  useCount: number;
  /** Sub-categories used under this one so far (e.g. Food → Elanir, Cake) — appended to whenever an entry names a new one, offered as chips in quick-add. */
  subcategories?: string[];
};

export type MoneyTx = {
  id: string;
  type: MoneyTxType;
  amountPaise: number;
  date: string; // yyyy-mm-dd
  /** Computed server-side from date + money_settings.monthStartDay — the client never sets this. */
  monthKey: string; // yyyy-mm
  categoryId: string;
  /** Optional finer label within the category (Food → "Elanir"). Totals still roll up by categoryId; this only drives the category drill-down. */
  subcategory?: string;
  note: string;
  mode?: MoneyMode;
  /** Which card — set for both a credit-card swipe (mode: 'credit_card') and a bill payment against that card (any other mode). */
  cardId?: string;
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
/* Net worth — monthly snapshots, not a live current-value list        */
/* ------------------------------------------------------------------ */
export const NW_ACCOUNT_KINDS = [
  "bank", "fd", "mf", "stocks", "epf", "ppf", "nps", "gold", "property", "other", "loan",
] as const;
export type NwAccountKind = (typeof NW_ACCOUNT_KINDS)[number];

export const NW_ASSET_CLASSES = ["equity", "retirement", "cash", "gold", "property"] as const;
export type NwAssetClass = (typeof NW_ASSET_CLASSES)[number];

export const NW_HELD_BY = ["yours", "hers", "joint"] as const;
export type NwHeldBy = (typeof NW_HELD_BY)[number];

export const NW_AUTO_PRICE = ["none", "gold", "nav"] as const;
export type NwAutoPrice = (typeof NW_AUTO_PRICE)[number];

export type NwAccount = {
  id: string;
  name: string;
  kind: NwAccountKind;
  /** Required for every kind except 'loan' — a loan is a liability, not part of the asset-allocation breakdown. */
  assetClass?: NwAssetClass;
  institution?: string;
  heldBy: NwHeldBy;
  liquid: boolean;
  /** Stored from day one; inert until the auto-pricing job exists. Manual entry always wins for now regardless of this value. */
  autoPrice: NwAutoPrice;
  quantity?: number;
  navCode?: string;
  investedPaise?: number; // MFs/stocks: cost basis, for a gain% sub-label
  loan?: { emiPaise: number; ratePct: number; endDate: string };
  /** Surfaces Money's "left to spend" for this month as a suggested (never auto-written) value on the update form — see networth.md's "balances always entered by hand" principle. */
  linkedToMoneyLeftover?: boolean;
  /** Same suggestion mechanism, sourced from a Money goal's savedPaise instead — e.g. an "Emergency Fund" account tracking a Money goal of the same name. Mutually exclusive with linkedToMoneyLeftover in practice, not enforced, since only one can ever produce the suggestion actually shown. */
  linkedToMoneyGoalId?: string;
  archived: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type NwSnapshot = {
  monthKey: string;
  values: Record<string, number>; // accountId -> paise
  enteredBy: Record<string, string>; // accountId -> email
  updatedAt: number;
  totals: {
    assetsPaise: number;
    liabilitiesPaise: number;
    netPaise: number;
    byAssetClass: Record<string, number>;
  };
};

export type NwSettings = {
  targetMix?: Record<string, number>; // assetClass -> pct
  reminderDay: number; // default 1, unused until monthly reminders exist
};

export type NwAccountsResponse = { items: NwAccount[] };

export const NW_GOLD_KARATS = [24, 22, 18] as const;
export type NwGoldKarat = (typeof NW_GOLD_KARATS)[number];

/**
 * One physical item (a chain, a bracelet, a coin) held under a 'gold'
 * assetClass account — separate from the account's monthly snapshot value,
 * which stays a hand-entered total, per networth.md's "balances always
 * entered by hand". Ownership comes from accountId's own heldBy (there's
 * already one Gold account per person) rather than a second heldBy on the
 * item, so the two can never disagree.
 */
export type NwGoldItem = {
  id: string;
  accountId: string;
  name: string;
  karat: NwGoldKarat;
  grams: number;
  /** Optional — old items you no longer have a buy price for. Without it, gain/loss just isn't shown for that item. */
  buyPricePaise?: number;
  buyDate: string; // ISO date
  /** Overrides the grams x today's-rate computation entirely — for old items where you'd rather just enter what it's worth today. */
  manualValuePaise?: number;
  createdAt: number;
  updatedAt: number;
};

/** Cached once per calendar day in nw_prices/{date} — never fetched more than once a day, and a manual override always wins over the next live fetch for that same day. */
export type NwGoldRate = {
  date: string;
  per24kGramPaise: number;
  per22kGramPaise: number;
  per18kGramPaise: number;
  /** 'chennai' = scraped from GoodReturns' Chennai city page (local retail rate). 'international' = spot XAU converted to INR, used only when the Chennai fetch fails. 'manual' = typed in by hand. */
  source: "chennai" | "international" | "manual";
  fetchedAt: number;
};

export type NwGoldPageResponse = {
  accounts: NwAccount[]; // assetClass === 'gold', not archived
  items: NwGoldItem[];
  rate: NwGoldRate | null;
};

export type NwUpdateRow = {
  account: NwAccount;
  previousValuePaise: number | null;
  currentValuePaise: number | null; // pre-filled from previous month if this month isn't saved yet
  /** Only set when account.linkedToMoneyLeftover — Money's leftPaise for this month, offered as a one-tap fill-in, never auto-applied. */
  suggestedValuePaise: number | null;
};
export type NwUpdateResponse = { monthKey: string; rows: NwUpdateRow[] };

export type NwTrendPoint = { monthKey: string; netPaise: number; liabilitiesPaise: number; hasData: boolean };

export type NwAccountRow = {
  account: NwAccount;
  valuePaise: number | null; // most recent known value, walking back through the fetched trend window
  valueMonthKey: string | null; // which month that value actually came from
  isStale: boolean; // valueMonthKey !== the viewed monthKey — spec: shown amber
  changeThisMonthPaise: number | null; // only set when both this month and last month have real values
};

export type NwDashboardResponse = {
  monthKey: string;
  isCurrentMonth: boolean;
  accounts: NwAccount[];
  snapshot: NwSnapshot;
  prevSnapshot: NwSnapshot | null;
  trend: NwTrendPoint[]; // oldest to newest, up to 12
  accountRows: NwAccountRow[];
  settings: NwSettings;
  /** Liquid assets ÷ average of the last 3 months' Money-section expensePaise. Null if there's no spending history yet. */
  emergencyCoverMonths: number | null;
  /** This month's Money-section savingPaise. Null if that month has no Money data at all yet. */
  savedThisMonthPaise: number | null;
  /** Accounts with no value recorded for the viewed month (i.e. still showing a carried-forward or missing figure). */
  pendingAccounts: NwAccount[];
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
