import { db } from "@/lib/firestore";
import { todayIST } from "@/lib/dates/logic";
import { upcoming, type Reminder, type ReminderCard, type ReminderDoc, type ReminderTrip } from "@/lib/reminders";
import type { DtEvent } from "@/lib/dates/types";
import type { MoneyCard, MoneyTx } from "@/lib/types";

/**
 * Loads what the reminders look at — dates, documents with an expiry, trips
 * that haven't ended, and credit-card balances — and returns upcoming items.
 * Used by the Home "Today" card and the morning notification.
 */
export async function loadUpcoming(now = new Date()): Promise<Reminder[]> {
  const today = todayIST(now);
  const todayStr = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
  const [datesSnap, docsSnap, tripsSnap, cardsSnap] = await Promise.all([
    db().collection("dates").get(),
    db().collection("doc_records").where("archived", "==", false).get(),
    db().collection("trips").get(),
    db().collection("money_cards").where("archived", "==", false).get(),
  ]);

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

  return upcoming({ today, dates, docs, trips, cards });
}
