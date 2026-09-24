import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { db } from "@/lib/firestore";
import { ok, fail } from "@/lib/http";
import { BadRequest, requirePerson } from "@/lib/fa/auth";
import { cacheFood } from "@/lib/fa/store";
import type { FaFood } from "@/lib/fa/types";

export const runtime = "nodejs";

/** food.md names Claude Haiku for this: cheap, fast, and a few cents a month at this volume. */
const MODEL = "claude-haiku-4-5";

const Estimate = z.object({
  name: z.string().describe("Short dish name, e.g. 'Idli with sambar'"),
  servingLabel: z.string().describe("The whole amount described or shown, e.g. '2 idli + 1 katori sambar'"),
  grams: z.number().describe("Approximate total weight of that amount in grams (liquids: 1 ml = 1 g)"),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fibre: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
});

const Body = z.object({
  text: z.string().trim().max(300).optional(),
  image: z.object({
    data: z.string().max(6_000_000),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  }).optional(),
});

const SYSTEM =
  "You estimate nutrition for meals eaten in a South Indian household (Tamil/Kannada/Telugu/Kerala home cooking is common, plus everyday North Indian and packaged foods). " +
  "Estimate the TOTAL for everything described or visible, using typical home-style portions and oil (a katori is ~150 ml; a chapati ~40 g of dough). " +
  "Numbers are grams except kcal. Use confidence 'low' when the portion or dish is unclear from the input.";

/**
 * POST /api/fa/foods/estimate { text } | { image } — last-resort AI estimate
 * (food.md source #5). Always labelled as an estimate, always editable, and
 * cached like any other fetched food. Disabled (503) until ANTHROPIC_API_KEY is set.
 */
export async function POST(req: Request) {
  try {
    await requirePerson();
    if (!process.env.ANTHROPIC_API_KEY) throw new BadRequest("AI estimate isn't set up (no ANTHROPIC_API_KEY)", 503);
    const body = Body.parse(await req.json());
    if (!body.text && !body.image) throw new BadRequest("Describe the food or add a photo");

    const content: Anthropic.ContentBlockParam[] = [];
    if (body.image) content.push({ type: "image", source: { type: "base64", media_type: body.image.mediaType, data: body.image.data } });
    content.push({ type: "text", text: body.text ? `Estimate: ${body.text}` : "Estimate the food in this photo." });

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(Estimate) },
    });
    if (response.stop_reason === "refusal") throw new BadRequest("Couldn't estimate that — try describing it in words");
    const est = response.parsed_output;
    if (!est) throw new BadRequest("Couldn't read an estimate — try again or type the numbers");

    const r1 = (n: number) => Math.round(Math.max(0, n) * 10) / 10;
    const food: FaFood = {
      key: `ai:${db().collection("foods").doc().id}`,
      name: est.name,
      source: "ai",
      baseLabel: est.servingLabel,
      ...(est.grams > 0 ? { gramsPerBase: Math.round(est.grams) } : {}),
      base: { kcal: Math.round(Math.max(0, est.kcal)), protein: r1(est.protein), carbs: r1(est.carbs), fat: r1(est.fat), fibre: r1(est.fibre) },
      servings: [{ label: est.servingLabel, mult: 1 }, { label: "Half of that", mult: 0.5 }],
      confidence: est.confidence,
    };
    await cacheFood(food);
    return ok({ food });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(new BadRequest("AI estimate is busy — try again in a minute", 429));
    if (e instanceof Anthropic.AuthenticationError) return fail(new BadRequest("AI estimate key is invalid", 503));
    return fail(e);
  }
}
