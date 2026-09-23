import { MoneyTransactionList } from "@/components/MoneyTransactionList";
import { MONEY_TX_TYPES, type MoneyTxType } from "@/lib/types";

export default async function MoneyTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; type?: string }>;
}) {
  const { month, type } = await searchParams;
  const initialType = MONEY_TX_TYPES.includes(type as MoneyTxType) ? (type as MoneyTxType) : null;
  return <MoneyTransactionList initialMonth={month ?? null} initialType={initialType} />;
}
