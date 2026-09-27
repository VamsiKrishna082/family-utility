import { db } from "@/lib/firestore";
import { todayIST } from "@/lib/dates/logic";
import { upcoming, type Reminder, type ReminderBudget, type ReminderCard, type ReminderDoc, type ReminderHealth, type ReminderTrip } from "@/lib/reminders";
import { computeMonthKey, getSettings } from "@/lib/moneyEngine";
import { HEALTH_PEOPLE } from "@/lib/health";
import type { DtEvent } from "@/lib/dates/types";
import type { MoneyBudget, MoneyCard, MoneyCategory, MoneyMonthSummary, MoneyTx } from "@/lib/types";

/**
 * Loads what the reminders look at — dates, documents with an expiry, trips
 * that haven't ended, and credit-card balances — and returns upcoming items.
 * Used by the Home "Today" card and the morning notification.
 */
export async function loadUpcoming(now = new Date()): Promise<Reminder[]> {
  const today = todayIST(now);
  const todayStr = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  const settings = await getSettings();
  const monthKey = computeMonthKey(todayStr, settings.monthStartDay);
  const [datesSnap, docsSnap, tripsSnap, cardsSnap, monthSnap, budgetSnap, catSnap, healthSnap] = await Promise.all([
    db().collection("dates").get(),
    db().collection("doc_records").where("archived", "==", false).get(),
    db().collection("trips").get(),
    db().collection("money_cards").where("archived", "==", false).get(),
    db().collection("money_months").doc(monthKey).get(),
    db().collection("money_budgets").doc(monthKey).get(),
    db().collection("money_categories").get(),
    db().collection("health_items").get(),
  ]);

  // Budgets are set per expense group; this month's spend per group comes from the month summary.
  const expenseGroups = new Set(catSnap.docs.map((d) => d.data() as MoneyCategory).filter((c) => c.type === "expense").map((c) => c.group));
  const spentByGroup = monthSnap.exists ? (monthSnap.data() as MoneyMonthSummary).byGroup : {};
  const budgets: ReminderBudget[] = Object.entries(budgetSnap.exists ? (budgetSnap.data() as MoneyBudget).byGroup : {})
    .filter(([group]) => expenseGroups.has(group))
    .map(([group, budgetPaise]) => ({ group, monthKey, spentPaise: spentByGroup[group] ?? 0, budgetPaise }));

  const nameOf = new Map<string, string>(HEALTH_PEOPLE.map((p) => [p.id, p.name]));
  const health: ReminderHealth[] = healthSnap.docs
    .map((d) => d.data() as ReminderHealth & { person: string })
    .filter((h) => h.nextDate)
    .map((h) => ({ ...h, personName: nameOf.get(h.person) ?? h.person }));

  const dates = datesSnap.docs.map((d) => d.data() as DtEvent);
  const docs = docsSnap.docs.map((d) => d.data() as ReminderDoc).filter((d) => d.expiryDate);
  const trips = tripsSnap.docs
    .map((d) => d.data() as ReminderTrip & { endDate?: string })
    .filter((t) => !t.endDate || t.endDate >= todayStr)
    .map((t) => ({ ...t, todos: t.todos ?? [], bookings: t.bookings ?? [] }));

  const cards: ReminderCard[] = await Promise.all(
    cardsSnap.docs.map(async (d) => {
      const card = d.data() as MoneyCard;
      const txs = await db().collection("money_tx").where("cardId", "==", card.id).get();
      let owed = 0;
      for (const t of txs.docs) {
        const tx = t.data() as MoneyTx;
        owed += tx.mode === "credit_card" ? tx.amountPaise : -tx.amountPaise;
      }
      return { id: card.id, name: card.last4 ? `${card.name} ••${card.last4}` : card.name, outstandingPaise: owed };
    }),
  );

  return upcoming({ today, dates, docs, trips, cards, budgets, health });
}
