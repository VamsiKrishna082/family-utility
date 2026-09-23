import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import type { MoneyCard, MoneyCreditCardSummary, MoneyCreditCardsResponse, MoneyTx } from "@/lib/types";

export const runtime = "nodejs";

function currentMonthKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}

/**
 * Per card: every mode:'credit_card' tx ever logged against it is a swipe
 * (spentPaise), every other tx with this cardId is a bill payment
 * (paidPaise) — see MoneyTx.cardId and moneyEngine's leftover exclusion.
 * Not month-scoped for the running total, since a card balance carries
 * across months; spentThisMonthPaise is the one figure that is.
 */
export async function GET() {
  try {
    await requireUser();
    const cur = currentMonthKey();
    const cardsSnap = await db().collection("money_cards").where("archived", "==", false).orderBy("order", "asc").get();
    const cards = cardsSnap.docs.map((d) => d.data() as MoneyCard);

    const summaries: MoneyCreditCardSummary[] = await Promise.all(
      cards.map(async (card) => {
        const txSnap = await db().collection("money_tx").where("cardId", "==", card.id).get();
        let spentPaise = 0, paidPaise = 0, spentThisMonthPaise = 0;
        for (const doc of txSnap.docs) {
          const tx = doc.data() as MoneyTx;
          if (tx.mode === "credit_card") {
            spentPaise += tx.amountPaise;
            if (tx.monthKey === cur) spentThisMonthPaise += tx.amountPaise;
          } else {
            paidPaise += tx.amountPaise;
          }
        }
        return { card, spentPaise, paidPaise, outstandingPaise: spentPaise - paidPaise, spentThisMonthPaise };
      }),
    );

    const response: MoneyCreditCardsResponse = {
      cards: summaries,
      totalOutstandingPaise: summaries.reduce((s, c) => s + c.outstandingPaise, 0),
    };
    return ok(response);
  } catch (e) {
    return fail(e);
  }
}
