# Money section — spec for Claude Code

Part of the household app (see root `CLAUDE.md` for the stack, auth, cost rules and conventions).
This file defines the **Money** section: a monthly dashboard for one pooled household pot shared by two people.
The visual reference is the "Money Dashboard" design canvas (desktop + phone artboards). Match its layout and hierarchy, not its sample numbers.

## Principles

- **The month is the unit.** The home screen of this section is the current month's dashboard, not a daily log. Daily entry exists only to feed the month.
- **One pooled pot.** No split-and-settle and no "who owes whom". `paidBy` is recorded for context only and never drives balances.
- **Entry must take seconds.** Amount → category → save. Everything else is optional.
- **Money is exact.** Store amounts as **integer paise** (`amountPaise`), never floats. Format for display with `en-IN` (₹1,15,100; ₹38.6 L for large totals).
- **Time zone is Asia/Kolkata** for dates, month keys and "days left".

## Month definition

- `monthKey` = `YYYY-MM`.
- Setting `monthStartDay` (default 1). If set to, for example, 28, the "September" cycle runs 28 Aug–27 Sep, to follow salary credit dates. Compute `monthKey` from the transaction date using this setting; never let the client decide it.

## Transaction types (critical for correct totals)

| type | Counts as | Examples |
|---|---|---|
| `income` | Income | Salary, freelance, interest, refunds |
| `expense` | Spent | Groceries, rent, card swipes |
| `saving` | Saved & invested | SIP, RD, FD, PPF, NPS, gold purchase as investment |
| `transfer` | Nothing (excluded from all totals) | **Credit card bill payment**, moving money between own accounts, ATM withdrawal |

A credit card purchase is recorded as an `expense` on the swipe date. The later card bill payment is a `transfer`, so it's never counted twice.

## Categories (seeded defaults, editable in the app)

Store as `group` → `category`. Users can rename, reorder, archive and add. Archived categories keep their history.

**Income:** Salary · Freelance / side income · Interest & dividends · Refunds & cashback · Gifts received · Other income

**Expense groups:**
- **Housing:** Rent · Society maintenance · Repairs & upkeep
- **Groceries & household:** Groceries · Vegetables & fruits · Milk & daily needs · Household supplies
- **Food & dining:** Dining out · Food delivery · Snacks & coffee
- **Utilities & recharges:** Electricity · Water · Cooking gas · Broadband · Mobile recharge
- **Transport:** Fuel · Cab / auto · Metro / bus / train · Vehicle service · Parking & tolls
- **EMIs & loans:** Home loan EMI · Vehicle loan EMI · Personal loan EMI · Card interest & late fees
- **Insurance:** Health · Term life · Vehicle
- **Health:** Doctor · Medicines · Lab tests
- **Shopping & personal:** Clothing · Electronics · Personal care & salon
- **Household help:** Maid · Cook · Driver · Laundry / ironing
- **Family & gifts:** Support to parents · Gifts · Functions & weddings · Festivals
- **Subscriptions & fun:** OTT & apps · Movies & outings · Hobbies
- **Travel:** Trips · Stays
- **Learning:** Courses & certifications · Books
- **Donations & offerings**
- **Fees & taxes:** Income tax · Bank charges · Government fees
- **Miscellaneous**

**Saving targets:** Mutual fund SIP · Recurring deposit · Fixed deposit · PPF · NPS · Stocks · Gold

**Transfer kinds:** Credit card bill payment · Own account transfer · Cash withdrawal

Budgets are set at the **group** level by default, with optional per-category budgets.

## Carry-over (leftover from the previous month)

Unspent money isn't lost at month end; it rolls into the next month.

- `surplus(M)` = Income − Spent − Saved for month M alone
- `carryIn(M)` = `left(M−1)`, which can be negative (a deficit carries forward too)
- `left(M)` = `carryIn(M)` + `surplus(M)`
- The first month ever uses `money_settings.openingBalancePaise` as its `carryIn`.
- **Move part to savings:** from the dashboard, the user can move some of the leftover into savings. This creates a `saving` entry in the current month (e.g. into the emergency fund), which lowers `left` and therefore next month's carry.
- Editing or deleting an entry in a past month changes that month's `left`. The API must then re-chain `carryIn`/`left` for every later month up to the current one, in the same transaction or a follow-up batch. Keep the chain short: at most 24 months are ever re-chained; older months are frozen.

## Dashboard (per month) — widgets, formulas and order

Net worth is **not** shown here; it lives in its own Net worth section.

1. **Header:** month switcher (‹ Sep 2026 ›), "+ Add entry" button, and a back link to the home launcher.
2. **KPI strip (5 cards, read left to right as an equation):**
   - **Carried over from {prev month}** = `carryIn`
   - **Income** = Σ `income`
   - **Spent** = Σ `expense`, with "% of budget" and "vs last month"
   - **Saved & invested** = Σ `saving`, with savings rate = Saved ÷ Income
   - **Left to spend** = `left` (red if negative), plus **safe-to-spend per day** = Left ÷ days remaining in the cycle, including today
3. **Recent entries** (wide, left) next to **Due in next 14 days** (right). Recent shows the last 7 entries plus "See all", which opens the filterable list. Due combines recurring entries and the Bills & renewals section, with a total.
4. **Budget vs spent** (wide, left), one row per group. Bar colour by % used: under 90% accent, 90–100% amber, over 100% red. Sort: over-budget first, then by % used. Next to it on the right: **Month-end leftover** (carried in + this month's surplus = what will carry into next month, plus a "Move part to savings" button) and **Goals** (progress bars).
5. **Last 6 months** (full width): income, spent and saved bars per month with the month's surplus under each. Tapping a month switches the dashboard to it.

On the phone, stack in this order: Left-to-spend hero (with carried over, income, spent and saved inside it in a 2×2 grid), Recent entries, Budget vs spent (top 6 plus "All"), Last 6 months (income vs spent only), Due soon. The "+ Add" button floats at the bottom right.

## Adding an entry (quick add)

- A bottom sheet opens with the amount field focused and a numeric keypad.
- Type toggle: Expense (default) / Income / Saving / Transfer.
- Category grid: the 8 most-used first, then search.
- Optional fields: note, date (defaults to today), payment mode (UPI / card / cash / bank transfer), paid by (defaults to the signed-in user), tags (e.g. `goa-trip`), receipt photo.
- "Save" and "Save & add another".
- The whole flow must work in 3 taps for the common case.

## Recurring entries

- Templates: name, type, amount, category, day of month, and whether to auto-post or remind only.
- A daily Cloud Scheduler job (already allowed in the free tier) posts due auto-post entries and marks reminders.
- Examples: rent, EMIs, SIPs (auto-post); electricity and card bill (remind, since the amount varies).

## Firestore model

```
money_settings/main          monthStartDay, currency:'INR', openingBalancePaise, updatedAt
money_categories/{id}        name, group, type, order, archived, icon?
money_tx/{id}                type, amountPaise, date 'YYYY-MM-DD', monthKey, categoryId,
                             note?, mode?, paidBy (uid), tags[], receiptPath?,
                             recurringId?, source ('manual'|'recurring'|'import'),
                             createdBy, createdAt, updatedAt
money_months/{monthKey}      incomePaise, expensePaise, savingPaise,
                             surplusPaise, carryInPaise, leftPaise,
                             byGroup {group: paise}, byCategory {id: paise},
                             byMode {mode: paise}, txCount, updatedAt
money_budgets/{monthKey}     byGroup {group: paise}, byCategory? {id: paise}
money_budget_template/main   default budgets copied into a new month on first open
money_recurring/{id}         name, type, amountPaise, categoryId, dayOfMonth,
                             autoPost, nextDate, active
money_goals/{id}             name, targetPaise, savedPaise, targetDate?
```

- **Month summaries are maintained by the API** inside the same Firestore transaction as every create, update or delete of `money_tx`, by applying the delta (old values out, new values in). The dashboard reads **one** `money_months` document plus the budget document, never a scan of transactions.
- Provide `POST /api/money/months/{monthKey}/recompute` to rebuild a summary from its transactions. It's used by tests and for repairs.
- Indexes: `money_tx` on (`monthKey` ASC, `date` DESC) and (`categoryId` ASC, `date` DESC).
- Security rules: read allowed only for allowlisted users; all writes go through the API (Admin SDK), because summaries must stay consistent.

## API (Cloud Run, all behind token + allowlist check)

```
GET    /api/money/dashboard?month=YYYY-MM    → KPIs, budgets, dues, goals, 6-month trend, recent
GET    /api/money/tx?month=&category=&tag=&q=&cursor=
POST   /api/money/tx          PATCH /api/money/tx/:id          DELETE /api/money/tx/:id
GET/PUT /api/money/budgets/:monthKey      GET/PUT /api/money/budget-template
CRUD   /api/money/categories  /api/money/recurring  /api/money/goals
GET    /api/money/export?from=&to=        → CSV
POST   /internal/money/run-recurring      (Cloud Scheduler, OIDC only)
```

`/dashboard` returns everything the screen needs in a single response (including carryIn and the previous month's name), so the page makes one call.

```
POST   /api/money/leftover/move    {amountPaise, categoryId}  → creates a saving entry in the current month
```

## Build order

1. Categories seed + settings, the transaction model, and the monthly summary with its transactional delta updates and recompute endpoint. Unit-test the delta math first, including edits that move an entry across months or categories.
2. Quick-add sheet and the transaction list (filters, search, edit, delete).
3. Dashboard: KPIs, budget vs spent, recent entries, month switcher.
4. Budgets: the template, per-month overrides, and the "copy last month" action.
5. Recurring entries and the scheduler job; the "Due in next 14 days" widget.
6. Carry-over chain (carryIn / left, re-chaining on past-month edits, "Move part to savings"), six-month trend and goals.
7. CSV export. Later, optional: bank statement CSV import, and automatic entries from bank alert emails via the Gmail API.

## Later ideas (not in first build)

- Budget alerts at 80% and 100%, and bill due reminders, via web push
- Month-end review screen: top 3 overspends, biggest single expenses, savings rate trend
- Year view and a tax helper (80C/80D totals from tagged entries)
- Cash wallet tracking
- Search by tag across months (e.g. total cost of a trip)

## Definition of done for each step

- Totals on the dashboard, including the carry-over chain, equal a recompute from raw transactions (automated test).
- No floats anywhere in money math.
- Works on a 390px-wide phone first, then desktop.
- The dashboard loads with one API call, and Firestore reads per dashboard view are at most 5.
