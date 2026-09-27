/**
 * Tax-season pack — pure (tested in scripts/tax.test.mjs). Pulls together a
 * financial year's (April–March) Money totals that matter at ITR time and a
 * checklist of the documents you'll need, matched from Documents. It
 * organises what's already in the app; it isn't tax advice.
 */

/** FY that contains `ymd`: "2026-09-27" → 2026 (FY 2026-27). */
export function fyOf(ymd: string): number {
  const [y, m] = ymd.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}
export const fyLabel = (fy: number) => `FY ${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
export const fyRange = (fy: number) => ({ from: `${fy}-04-01`, to: `${fy + 1}-03-31` });

export type TaxBucket = "rent" | "health" | "education" | "donations" | "homeLoan" | "sec80c" | "nps" | "otherInvest";
export const TAX_BUCKET_LABEL: Record<TaxBucket, string> = {
  rent: "Rent paid (HRA)",
  health: "Health insurance & medical (80D)",
  education: "Children's tuition fees (80C)",
  donations: "Donations (80G)",
  homeLoan: "Home loan (24b / 80C)",
  sec80c: "80C investments (PPF, ELSS, LIC, EPF…)",
  nps: "NPS (80CCD)",
  otherInvest: "Other savings & investments",
};

const RULES: [TaxBucket, RegExp][] = [
  ["nps", /\bnps\b|national pension/i],
  ["sec80c", /\bppf\b|\belss\b|\blic\b|\bepf\b|provident|sukanya|\bnsc\b|tax ?sav|life insurance|term (plan|insurance)|ulip/i],
  ["homeLoan", /home ?loan|housing loan|\bemi\b.*(house|home|flat)|(house|home|flat).*\bemi\b/i],
  ["rent", /\brent\b|house rent|\bpg\b/i],
  ["health", /health ?insurance|mediclaim|medical|hospital|doctor|clinic|pharma|medicine|diagnos|\blab\b/i],
  ["education", /tuition|school fee|college fee|education fee/i],
  ["donations", /donat|charity|\bngo\b|temple|trust/i],
];

/** Which tax bucket an entry belongs to, from its category name, sub-category and note. */
export function bucketOf(type: "expense" | "saving" | "income" | string, text: string): TaxBucket | null {
  for (const [b, re] of RULES) {
    if (!re.test(text)) continue;
    if ((b === "sec80c" || b === "nps") && type !== "saving" && !/insurance|lic|term/i.test(text)) continue;
    return b;
  }
  return type === "saving" ? "otherInvest" : null;
}

export type TaxTx = { type: string; amountPaise: number; date: string; categoryName: string; subcategory?: string; note?: string };

export function taxTotals(txs: TaxTx[], fy: number) {
  const { from, to } = fyRange(fy);
  const inYear = txs.filter((t) => t.date >= from && t.date <= to);
  const income = new Map<string, number>();
  const buckets = new Map<TaxBucket, { totalPaise: number; count: number }>();
  for (const t of inYear) {
    if (t.type === "income") income.set(t.categoryName, (income.get(t.categoryName) ?? 0) + t.amountPaise);
    const b = bucketOf(t.type, `${t.categoryName} ${t.subcategory ?? ""} ${t.note ?? ""}`);
    if (!b) continue;
    const cur = buckets.get(b) ?? { totalPaise: 0, count: 0 };
    buckets.set(b, { totalPaise: cur.totalPaise + t.amountPaise, count: cur.count + 1 });
  }
  return {
    incomeByCategory: [...income.entries()].sort((a, b) => b[1] - a[1]).map(([name, paise]) => ({ name, paise })),
    incomeTotalPaise: [...income.values()].reduce((s, v) => s + v, 0),
    buckets: (Object.keys(TAX_BUCKET_LABEL) as TaxBucket[]).filter((b) => buckets.has(b)).map((b) => ({ bucket: b, label: TAX_BUCKET_LABEL[b], ...buckets.get(b)! })),
  };
}

export const TAX_CHECKLIST: { key: string; label: string; hint: string; re: RegExp }[] = [
  { key: "form16", label: "Form 16", hint: "From your employer, usually in June", re: /form ?16\b(?!a)/i },
  { key: "ais", label: "AIS / Form 26AS", hint: "Download from the income-tax portal", re: /\bais\b|26 ?as|annual information|\btis\b/i },
  { key: "salary", label: "Payslips", hint: "For HRA and allowances", re: /payslip|pay slip|salary slip/i },
  { key: "rent", label: "Rent receipts / agreement", hint: "For HRA", re: /rent (receipt|agreement)|rental agreement|lease/i },
  { key: "80c", label: "80C proofs", hint: "PPF, ELSS, LIC, tuition fee receipts", re: /\bppf\b|\belss\b|\blic\b|80 ?c\b|tuition|sukanya|\bnsc\b|premium receipt/i },
  { key: "80d", label: "Health insurance premium (80D)", hint: "Premium receipt or policy", re: /80 ?d\b|health insurance|mediclaim|star health|care health|niva bupa|hdfc ergo/i },
  { key: "homeloan", label: "Home-loan interest certificate", hint: "From the lender", re: /(home|housing) loan|interest certificate/i },
  { key: "interest", label: "Bank interest certificates", hint: "Savings & FD interest", re: /interest (certificate|statement)|\bfd\b|fixed deposit|tds certificate|form 16a/i },
  { key: "capgains", label: "Capital-gains statement", hint: "From your broker / mutual fund", re: /capital gain|\bp ?& ?l\b|tax p&l|cas statement|consolidated account statement/i },
];

export type TaxDoc = { id: string; name: string; text: string };

/** The checklist with the documents that match each item (by name, tags, folder and category). */
export function taxChecklist(docs: TaxDoc[]) {
  return TAX_CHECKLIST.map((c) => ({ key: c.key, label: c.label, hint: c.hint, docs: docs.filter((d) => c.re.test(`${d.name} ${d.text}`)).map((d) => ({ id: d.id, name: d.name })) }));
}
