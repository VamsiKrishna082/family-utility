import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { getAccounts } from "@/lib/networthEngine";
import { NW_ACCOUNT_KINDS, NW_ASSET_CLASSES, NW_AUTO_PRICE, NW_HELD_BY, type NwAccount } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    return ok({ items: await getAccounts() });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(NW_ACCOUNT_KINDS),
  assetClass: z.enum(NW_ASSET_CLASSES).optional(),
  institution: z.string().trim().max(80).optional(),
  heldBy: z.enum(NW_HELD_BY),
  liquid: z.boolean().default(false),
  autoPrice: z.enum(NW_AUTO_PRICE).default("none"),
  quantity: z.number().positive().optional(),
  navCode: z.string().trim().max(30).optional(),
  investedPaise: z.number().int().positive().optional(),
  loan: z.object({ emiPaise: z.number().int().positive(), ratePct: z.number().positive(), endDate: z.string() }).optional(),
  linkedToMoneyLeftover: z.boolean().optional(),
  linkedToMoneyGoalId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    if (body.kind !== "loan" && !body.assetClass) throw new Error("assetClass is required for every kind except loan");

    const col = db().collection("nw_accounts");
    const existing = await col.get();
    const ref = col.doc();
    const now = Date.now();
    const account: NwAccount = { id: ref.id, ...body, archived: false, order: existing.size, createdAt: now, updatedAt: now };
    await ref.set(account);
    return ok({ account });
  } catch (e) {
    return fail(e);
  }
}
