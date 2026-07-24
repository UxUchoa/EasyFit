import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { searchOpenFoodFacts } from "@/lib/catalog/open-food-facts-search";
import { searchUsdaFoods } from "@/lib/catalog/usda-food-data";

type CatalogFood = Prisma.FoodGetPayload<{ include: { portions: true } }>;

export type ResolvedImportFood = {
  foodId: string | null;
  name: string;
  source: string;
  confidence: number;
  declaredCalories: number | null;
};

type QueryPreset = { query: string; portionGrams?: number };

const USDA_QUERY_PRESETS = new Map<string, QueryPreset>([
  ["pao", { query: "bread white commercially prepared" }],
  ["ovo", { query: "egg whole cooked hard-boiled", portionGrams: 50 }],
  ["queijo mucarela", { query: "cheese mozzarella whole milk" }],
  ["queijo mussarela", { query: "cheese mozzarella whole milk" }],
  ["whey protein", { query: "whey protein powder" }],
  ["banana", { query: "bananas raw" }],
  ["arroz cozido", { query: "rice white long-grain cooked" }],
  ["peito de frango grelhado", { query: "chicken breast meat only cooked grilled" }],
  ["salada crua variada", { query: "salad mixed vegetables raw" }],
  ["azeite de oliva", { query: "oil olive salad or cooking" }],
  ["peito de peru", { query: "turkey breast sliced prepackaged" }],
  ["queijo coalho", { query: "cheese queso fresco" }],
  ["peixe grelhado", { query: "fish cooked dry heat" }],
  ["maca", { query: "apples raw with skin" }],
  ["bacon", { query: "pork cured bacon cooked" }],
  ["carne bovina magra grelhada", { query: "beef composite lean cooked grilled" }],
]);

export function normalizeFoodName(value: string) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function externalQueryForFood(value: string) {
  const normalized = normalizeFoodName(value);
  const exact = USDA_QUERY_PRESETS.get(normalized);
  if (exact) return exact;
  const partial = [...USDA_QUERY_PRESETS.entries()].find(([name]) => normalized.includes(name) || name.includes(normalized));
  return partial?.[1] ?? null;
}

export function catalogSearchTermsForFood(value: string) {
  const preset = externalQueryForFood(value);
  const portugueseHead = value.trim().split(/\s+/).find((term) => term.length > 2) ?? null;
  const englishHead = preset?.query.split(/\s+/).find((term) => term.length > 2) ?? null;
  return [...new Set([value.trim(), portugueseHead, englishHead].filter((term): term is string => Boolean(term)))];
}

export function extractDeclaredCalories(value: string) {
  const match = value.match(/(?:^|\D)(\d{1,5}(?:[.,]\d+)?)\s*kcal\b/i);
  if (!match) return null;
  const calories = Number(match[1].replace(",", "."));
  return Number.isFinite(calories) && calories >= 0 && calories <= 100_000 ? calories : null;
}

function tokens(value: string) {
  return new Set(normalizeFoodName(value).split(" ").filter((token) => token.length > 1));
}

export function foodNameSimilarity(query: string, candidate: string) {
  const left = normalizeFoodName(query);
  const right = normalizeFoodName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.includes(left) || left.includes(right)) return 0.92;
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function resolvedFromCatalog(food: CatalogFood, confidence: number): ResolvedImportFood {
  return { foodId: food.id, name: food.name, source: food.source, confidence, declaredCalories: null };
}

async function cacheUsdaFood(originalName: string, result: Awaited<ReturnType<typeof searchUsdaFoods>>[number], preset: QueryPreset) {
  const existing = await db.food.findFirst({ where: { source: "USDA_FDC", sourceReference: result.sourceReference }, include: { portions: true } });
  const nutrition = {
    name: originalName,
    brand: result.description.slice(0, 120),
    source: "USDA_FDC",
    sourceReference: result.sourceReference,
    sourceFetchedAt: new Date(),
    baseQuantity: result.baseQuantity,
    baseUnit: result.baseUnit,
    calories: result.calories,
    proteinGrams: result.proteinGrams,
    carbohydrateGrams: result.carbohydrateGrams,
    fatGrams: result.fatGrams,
    fiberGrams: result.fiberGrams,
  };
  const food = existing
    ? await db.food.update({ where: { id: existing.id }, data: nutrition, include: { portions: true } })
    : await db.food.create({ data: nutrition, include: { portions: true } });
  if (!preset.portionGrams || food.portions.some((portion) => normalizeFoodName(portion.unit) === "unidade")) return food;
  await db.foodPortion.create({ data: { foodId: food.id, name: "unidade", unit: "unidade", quantityInBaseUnit: preset.portionGrams } });
  return db.food.findUniqueOrThrow({ where: { id: food.id }, include: { portions: true } });
}

async function cacheOpenFoodFactsResult(result: Awaited<ReturnType<typeof searchOpenFoodFacts>>[number]) {
  const now = new Date();
  const { barcode, sourceReference, ...nutrition } = result;
  return db.food.upsert({
    where: { barcode_source: { barcode, source: "OPEN_FOOD_FACTS" } },
    create: { ...nutrition, barcode, source: "OPEN_FOOD_FACTS", sourceReference, sourceFetchedAt: now, sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000) },
    update: { ...nutrition, sourceReference, sourceFetchedAt: now, sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000) },
    include: { portions: true },
  });
}

async function resolveExternal(originalName: string): Promise<ResolvedImportFood | null> {
  const preset = externalQueryForFood(originalName);
  if (preset) {
    try {
      const candidate = (await searchUsdaFoods(preset.query))
        .map((food) => ({ food, score: foodNameSimilarity(preset.query, food.description) }))
        .sort((a, b) => b.score - a.score)[0];
      if (candidate && candidate.score >= 0.45) return resolvedFromCatalog(await cacheUsdaFood(originalName, candidate.food, preset), Math.max(0.86, Math.min(0.96, candidate.score)));
    } catch {
      // Open Food Facts remains available as a free fallback below.
    }
  }
  try {
    const candidates = await searchOpenFoodFacts(originalName);
    const ranked = candidates
      .map((candidate) => ({ candidate, score: foodNameSimilarity(originalName, candidate.name) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const minimum = preset ? 0.5 : 0.84;
    if (!best || best.score < minimum) return null;
    return resolvedFromCatalog(await cacheOpenFoodFactsResult(best.candidate), Math.max(0.82, best.score));
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, task: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await task(values[index]);
    }
  }));
  return results;
}

export async function resolveImportFoodNames(userId: string, names: string[]) {
  const uniqueNames = [...new Map(names.map((name) => [normalizeFoodName(name), name])).values()];
  const foods = await db.food.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }], source: { not: "FATSECRET" }, calories: { gte: 0, lte: 1_000 } },
    include: { portions: true },
    take: 2_000,
  });
  const resolved = new Map<string, ResolvedImportFood>();
  const unresolved: string[] = [];

  for (const name of uniqueNames) {
    const key = normalizeFoodName(name);
    const declaredCalories = extractDeclaredCalories(name);
    if (declaredCalories !== null) {
      resolved.set(key, { foodId: null, name, source: "JSON_EXPLICIT", confidence: 1, declaredCalories });
      continue;
    }
    const ranked = foods.map((food) => ({ food, score: foodNameSimilarity(name, food.name) })).sort((a, b) => b.score - a.score);
    if (ranked[0]?.score >= 0.88) resolved.set(key, resolvedFromCatalog(ranked[0].food, ranked[0].score));
    else unresolved.push(name);
  }

  if (process.env.DISABLE_EXTERNAL_FOOD_SEARCH === "1") return resolved;
  const externallyResolved = await mapWithConcurrency(unresolved.slice(0, 30), 3, resolveExternal);
  externallyResolved.forEach((result, index) => {
    if (result) resolved.set(normalizeFoodName(unresolved[index]), result);
  });
  return resolved;
}
