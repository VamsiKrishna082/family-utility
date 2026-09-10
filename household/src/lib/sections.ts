import {
  Images, Wallet, TrendingUp, FolderLock, ListChecks, Repeat, CalendarHeart,
  Plane, Bookmark, Car, Siren, type LucideIcon,
} from "lucide-react";

export type Section = {
  key: string;
  name: string;
  href: string;
  icon: LucideIcon;
  tint: string;
  ink: string;
  blurb: string;
  ready: boolean;
};

/** One list drives the launcher tiles and the left rail. Flip `ready` as each section lands. */
export const SECTIONS: Section[] = [
  { key: "album", name: "Album", href: "/album", icon: Images, tint: "#e7eef3", ink: "#3e6b85", blurb: "Photos and videos", ready: true },
  { key: "money", name: "Money", href: "/money", icon: Wallet, tint: "#e8f0ea", ink: "#2f6b4f", blurb: "The monthly budget", ready: false },
  { key: "worth", name: "Net worth", href: "/worth", icon: TrendingUp, tint: "#f2ece2", ink: "#8a6a32", blurb: "What you own", ready: false },
  { key: "docs", name: "Documents", href: "/docs", icon: FolderLock, tint: "#eceaf3", ink: "#57519a", blurb: "Papers that matter", ready: false },
  { key: "lists", name: "Lists", href: "/lists", icon: ListChecks, tint: "#f2ede8", ink: "#97664a", blurb: "To-dos and groceries", ready: false },
  { key: "bills", name: "Bills", href: "/bills", icon: Repeat, tint: "#f4e9ea", ink: "#a04b50", blurb: "Bills and renewals", ready: false },
  { key: "dates", name: "Dates", href: "/dates", icon: CalendarHeart, tint: "#efeee5", ink: "#6e7043", blurb: "Birthdays and more", ready: false },
  { key: "trips", name: "Trips", href: "/trips", icon: Plane, tint: "#e5efee", ink: "#2f6e6b", blurb: "Where you are going", ready: false },
  { key: "wish", name: "Wishlist", href: "/wishlist", icon: Bookmark, tint: "#f2e9f0", ink: "#8a4f76", blurb: "Watch, eat, buy", ready: false },
  { key: "cars", name: "Vehicles", href: "/vehicles", icon: Car, tint: "#e9ecf3", ink: "#4a5c86", blurb: "Service and fuel", ready: false },
  { key: "sos", name: "Emergency", href: "/emergency", icon: Siren, tint: "#f6e8e6", ink: "#a8453a", blurb: "In case of", ready: false },
];
