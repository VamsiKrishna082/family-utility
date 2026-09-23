import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { getGoldRate, setManualGoldRate } from "@/lib/goldPrice";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    return ok({ rate: await getGoldRate() });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({ per24kGramPaise: z.number().int().positive() });

export async function PUT(req: Request) {
  try {
    await requireUser();
    const { per24kGramPaise } = Body.parse(await req.json());
    return ok({ rate: await setManualGoldRate(per24kGramPaise) });
  } catch (e) {
    return fail(e);
  }
}
