export type Entry = {
  id: string;
  name: string;
  kind: "folder" | "photo" | "video";
  width: number | null;
  height: number | null;
  durationLabel: string | null;
  createdTime: string;
  hasThumb: boolean;
};

export type Crumb = { id: string; name: string };

export type BrowseResponse = {
  folderId: string;
  crumbs: Crumb[];
  entries: Entry[];
};

/* ------------------------------------------------------------------ */
/* Money — one pooled pot, no split-and-settle                         */
/* ------------------------------------------------------------------ */
export const MONEY_EXPENSE_CATEGORIES = [
  "Groceries", "Rent", "Utilities", "Transport", "Health",
  "Dining", "Shopping", "Entertainment", "Other",
] as const;
export const MONEY_INCOME_CATEGORIES = ["Salary", "Other"] as const;

export type MoneyEntry = {
  id: string;
  kind: "income" | "expense";
  amount: number; // rupees, whole numbers only
  category: string;
  note: string;
  date: string; // yyyy-mm-dd
  addedBy: string; // email
  createdAt: number; // epoch ms
};

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
