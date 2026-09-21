const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 4200 -> "₹4,200" (Indian digit grouping, no decimals — this app doesn't track paise). */
export function formatINR(amount: number): string {
  return formatter.format(amount);
}
