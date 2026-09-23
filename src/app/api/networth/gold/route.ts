import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { getGoldRate } from "@/lib/goldPrice";
import type { NwAccount, NwGoldItem, NwGoldPageResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    const [accountsSnap, itemsSnap, rate] = await Promise.all([
      db().collection("nw_accounts").where("assetClass", "==", "gold").get(),
      db().collection("nw_gold_items").orderBy("createdAt", "asc").get(),
      getGoldRate(),
    ]);
    const accounts = accountsSnap.docs.map((d) => d.data() as NwAccount).filter((a) => !a.archived);
    const items = itemsSnap.docs.map((d) => d.data() as NwGoldItem);
    const response: NwGoldPageResponse = { accounts, items, rate };
    return ok(response);
  } catch (e) {
    return fail(e);
  }
}
