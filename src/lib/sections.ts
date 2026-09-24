import {
  Images, Wallet, TrendingUp, FolderLock, CalendarHeart,
  Plane, Utensils, type LucideIcon,
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
  { key: "money", name: "Money", href: "/money", icon: Wallet, tint: "#e8f0ea", ink: "#2f6b4f", blurb: "The monthly budget", ready: true },
  { key: "worth", name: "Net worth", href: "/worth", icon: TrendingUp, tint: "#f2ece2", ink: "#8a6a32", blurb: "What you own", ready: true },
  { key: "docs", name: "Documents", href: "/docs", icon: FolderLock, tint: "#eceaf3", ink: "#57519a", blurb: "Papers that matter", ready: true },
  { key: "dates", name: "Dates", href: "/dates", icon: CalendarHeart, tint: "#efeee5", ink: "#6e7043", blurb: "Birthdays and more", ready: true },
  { key: "trips", name: "Trips", href: "/trips", icon: Plane, tint: "#e5efee", ink: "#2f6e6b", blurb: "Where you are going", ready: true },
  { key: "food", name: "Food", href: "/food", icon: Utensils, tint: "#f4e9e5", ink: "#a85d2f", blurb: "Food and movement, daily", ready: true },
];
