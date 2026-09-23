# Net worth section — spec for Claude Code

Part of the household app (see root `CLAUDE.md` for the stack, auth, cost rules and conventions; `docs/money.md` for the Money section).
The visual reference is the "Net Worth" design canvas (desktop + phone artboards). Match its layout and hierarchy, not its sample numbers.

## Principles

- **Snapshot-based, not live.** One snapshot per month per account. Net worth is a slow number; chasing live balances would mean bank integrations the app can't legally have.
- **Updating must be a 2-minute monthly ritual, not a chore.** One screen, one field per account, previous value pre-filled, keyboard set to numeric.
- **Nothing is auto-guessed except prices.** Only quantity × price assets (mutual funds, stocks, gold) are refreshed automatically. Balances are always entered by hand.
- **No account numbers, ever.** Store the institution name and an optional label only. Never a full account number, customer ID or password.
- **Integer paise** for all amounts, `en-IN` formatting, and lakh/crore short forms (₹38.60 L) for headline figures.

## Concepts

- **Account** = anything holding value: a bank account, FD, mutual fund folio, stock portfolio, EPF, PPF, NPS, gold, property, or a loan (a liability account).
- **Snapshot** = the value of every account for a given `monthKey` (`YYYY-MM`).
- **Net worth** = Σ asset values − Σ liability balances, for the selected snapshot.
- **Held by** = Yours / Hers / Joint. It's for nominee and tax clarity only; the money itself is still one pooled pot.

## Page layout (desktop; phone stacks in the same order)

1. **Header:** snapshot month switcher, "Update balances" button, back link to home.
2. **Top strip (4 cards):**
   - **Net worth** (dark hero): total, change this month in ₹ and %, and change over 12 months
   - **Assets** with account count
   - **Liabilities** with loan count and the month's reduction
   - **Emergency cover** = liquid assets ÷ average monthly spend of the last 3 months (from the Money section). Liquid = savings + FDs breakable without penalty.
3. **Last 12 months** (wide): net worth bars with liabilities stacked below the axis line in a lighter tone, each month's value above the bar. Tapping a month switches the snapshot.
4. **Allocation** (right): one stacked bar plus a legend for Equity, Retirement, Cash & deposits, Gold, Property. Show drift against a target mix if one is set in Settings.
5. **Accounts** (wide): name, sub-label (institution, and for MFs invested amount and gain %), held by, value, change this month, and last updated. Values older than the current snapshot are amber.
6. **Loans** (right): per loan, outstanding, a paid-off progress bar, EMI, months left and interest rate.
7. **Snapshot status** (right, dashed border): "6 of 8 done", with a one-tap "Enter value" for each account still carrying last month's figure.
8. **Insight strip (3 small cards):** money saved this month (from the Money section), growth from market movement (value change that isn't new contributions), and a debt-free date at the current EMI.

**Update balances flow:** a single scrolling form, one row per account, previous month's value shown greyed as a hint, "same as last month" button per row, and a running total at the bottom that updates as you type. Auto-priced accounts are pre-filled and marked as such.

## Data model (Firestore)

```
nw_accounts/{id}        name, kind ('bank'|'fd'|'mf'|'stocks'|'epf'|'ppf'|'nps'|
                                    'gold'|'property'|'other'|'loan'),
                        assetClass ('equity'|'retirement'|'cash'|'gold'|'property'),
                        institution?, heldBy ('yours'|'hers'|'joint'),
                        liquid (bool), autoPrice ('none'|'gold'|'nav'),
                        quantity?, navCode?,        // for auto-priced accounts
                        investedPaise?,             // for MFs and stocks: cost basis
                        loan? { emiPaise, ratePct, endDate },
                        archived, order, createdAt
nw_snapshots/{monthKey} values { accountId: paise }, enteredBy { accountId: uid },
                        updatedAt, totals { assetsPaise, liabilitiesPaise, netPaise,
                        byAssetClass { class: paise } }
nw_settings/main        targetMix? { class: pct }, reminderDay (default 1)
nw_prices/{date}        goldPerGramPaise, navs { code: paise }   // cached daily
```

- Totals are computed by the API when a snapshot is written, so the page reads **one** snapshot document plus the accounts list. The 12-month chart reads 12 snapshot documents (well within the free tier).
- Carry-forward: opening the update screen for a new month copies last month's values as defaults; nothing is written until saved.
- `POST /api/networth/snapshots/{monthKey}/recompute` rebuilds totals from stored values.

## API

```
GET    /api/networth?month=YYYY-MM     → cards, allocation, accounts, loans, 12-month trend, pending list
GET    /api/networth/update?month=     → the update form's rows, pre-filled
PUT    /api/networth/snapshots/:monthKey   { accountId: paise, ... }   (partial saves allowed)
CRUD   /api/networth/accounts
GET/PUT /api/networth/settings
POST   /internal/networth/refresh-prices   (Cloud Scheduler, OIDC only)
```

## Automatic pricing (free sources only)

- **Mutual funds:** AMFI publishes a daily NAV text file for every scheme code. A daily job parses it, caches NAVs in `nw_prices`, and computes value = units × NAV. Store units per folio, not rupees.
- **Gold:** cache a daily rate and compute value = grams × rate. Let the user override the rate, since jewellery and coins price differently.
- **Stocks, EPF, PPF, NPS, property:** entered by hand. EPF and PPF change predictably, so offer "add expected interest" rather than a scrape.
- If a price fetch fails, keep the previous value and mark the row stale. Never let a failed fetch zero an account.

## Reminders

On the `reminderDay` of each month, a scheduled job sends a push notification: "Time for the September snapshot: 8 accounts to confirm." A second nudge follows a week later if the snapshot is still incomplete. Reuse the same scheduler and push setup as the Money section.

## Cross-section links

- Emergency cover and the "saved this month" card read the Money section's monthly summaries. Read them; never recompute spending here.
- Loan EMIs shown here are the same recurring entries defined in the Money section, referenced by id, not duplicated.
- Goals (emergency fund, trip fund) stay in the Money section. This page shows funding progress only if a goal is linked to an account.

## Build order

1. Accounts CRUD, then snapshot storage with computed totals and recompute.
2. Update-balances form with carry-forward defaults and partial saves.
3. The page: top strip, accounts table, loans.
4. 12-month trend and allocation.
5. Snapshot status card and monthly reminders.
6. Auto-pricing job for NAVs and gold.
7. Insight cards, including growth-from-markets, which is (change in value) − (contributions recorded as savings in the Money section).

## Later ideas

- XIRR per investment account, once a contribution history exists
- Target mix with a rebalancing nudge
- Year-end statement PDF for tax filing
- What-if: prepaying the home loan versus investing the same amount
- Property valuation entered once a year rather than monthly

## Definition of done

- Net worth on the page equals a recompute from account values (automated test).
- Updating all balances for a month takes under 2 minutes on a phone.
- No account numbers or credentials are stored anywhere.
- A failed price fetch degrades gracefully and never overwrites a real value.
