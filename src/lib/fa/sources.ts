import type { FaFood, FaNutrition, FaServing } from "@/lib/fa/types";

/**
 * Online nutrition sources (food.md resolution order #3 and #4). Both are
 * best-effort with a short timeout: search must stay fast, and the local
 * table + your foods already cover most home cooking.
 */
const TIMEOUT_MS = 3500;
const UA = "household-app/1.0 (private family app)";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string>;
};

function fromOff(p: OffProduct): FaFood | null {
  const n = p.nutriments ?? {};
  const name = (p.product_name_en || p.product_name || "").trim();
  const kcal100 = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
  if (!name || !p.code || !kcal100) return null;
  const base: FaNutrition = {
    kcal: Math.round(kcal100),
    protein: r1(num(n.proteins_100g)),
    carbs: r1(num(n.carbohydrates_100g)),
    fat: r1(num(n.fat_100g)),
    fibre: r1(num(n.fiber_100g)),
  };
  const servings: FaServing[] = [];
  const sq = num(p.serving_quantity);
  if (sq > 0) servings.push({ label: `1 serving${p.serving_size ? ` (${p.serving_size})` : ""}`, mult: sq / 100 });
  servings.push({ label: "100 g", mult: 1 }, { label: "50 g", mult: 0.5 }, { label: "30 g", mult: 0.3 });
  return {
    key: `off:${p.code}`,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    barcode: p.code,
    source: "off",
    baseLabel: "100 g",
    gramsPerBase: 100,
    base,
    servings,
  };
}

const OFF_FIELDS = "code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments";

export async function searchOpenFoodFacts(q: string): Promise<FaFood[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=${OFF_FIELDS}`;
  const data = (await getJson(url)) as { products?: OffProduct[] } | null;
  return (data?.products ?? []).map(fromOff).filter((f): f is FaFood => f !== null).slice(0, 6);
}

export async function lookupBarcode(code: string): Promise<FaFood | null> {
  const data = (await getJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`)) as
    | { status?: number; product?: OffProduct }
    | null;
  if (!data?.product) return null;
  return fromOff({ ...data.product, code: data.product.code ?? code });
}

type UsdaFood = { fdcId: number; description: string; foodNutrients?: { nutrientNumber?: string; nutrientName?: string; value?: number; unitName?: string }[] };

/** USDA FoodData Central — only when USDA_API_KEY is set (free key from api.data.gov). */
export async function searchUsda(q: string): Promise<FaFood[]> {
  const key = process.env.USDA_API_KEY;
  if (!key) return [];
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(q)}&pageSize=5&dataType=Foundation,SR%20Legacy`;
  const data = (await getJson(url)) as { foods?: UsdaFood[] } | null;
  return (data?.foods ?? []).map((f) => {
    const get = (nums: string[]) => num(f.foodNutrients?.find((x) => nums.includes(x.nutrientNumber ?? ""))?.value);
    const kcal = get(["208", "957", "958"]);
    return {
      key: `usda:${f.fdcId}`,
      name: f.description.charAt(0) + f.description.slice(1).toLowerCase(),
      source: "usda" as const,
      baseLabel: "100 g",
      gramsPerBase: 100,
      base: { kcal: Math.round(kcal), protein: r1(get(["203"])), carbs: r1(get(["205"])), fat: r1(get(["204"])), fibre: r1(get(["291"])) },
      servings: [{ label: "100 g", mult: 1 }, { label: "50 g", mult: 0.5 }, { label: "200 g", mult: 2 }],
    };
  }).filter((f) => f.base.kcal > 0);
}
