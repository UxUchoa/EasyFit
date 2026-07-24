import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { Prisma } from '@prisma/client';
import { foodConflictGroups, foodConflictKey } from '@/lib/catalog/conflicts';
import { searchOpenFoodFacts } from '@/lib/catalog/open-food-facts-search';
import { searchUsdaFoods } from '@/lib/catalog/usda-food-data';
import { externalQueryForFood, normalizeFoodName } from '@/lib/imports/food-resolver';

export const runtime = "nodejs";

type SearchFood = Prisma.FoodGetPayload<{ include: { portions: true; favorites: { select: { userId: true } } } }>;

async function withConflictMetadata(userId: string, foods: SearchFood[]) {
  const groups = foodConflictGroups(foods);
  const keys = [...groups.keys()];
  const choices = keys.length ? await db.foodSourceChoice.findMany({ where: { userId, conflictKey: { in: keys } }, select: { conflictKey: true, selectedFoodId: true } }) : [];
  const selectedByKey = new Map(choices.map((choice) => [choice.conflictKey, choice.selectedFoodId]));
  return foods.map((food) => {
    const key = foodConflictKey(food);
    const alternatives = groups.get(key);
    return {
      id: food.id,
      name: food.name,
      brand: food.brand,
      baseQuantity: food.baseQuantity.toString(),
      baseUnit: food.baseUnit,
      calories: food.calories.toString(),
      proteinGrams: food.proteinGrams?.toString() ?? null,
      carbohydrateGrams: food.carbohydrateGrams?.toString() ?? null,
      fatGrams: food.fatGrams?.toString() ?? null,
      source: food.source,
      portions: food.portions.map((portion) => ({
        id: portion.id,
        name: portion.name,
        unit: portion.unit,
        quantityInBaseUnit: portion.quantityInBaseUnit.toString(),
      })),
      favorite: food.favorites.length > 0,
      conflictKey: alternatives ? key : null,
      conflictSize: alternatives?.length ?? 0,
      preferredSource: alternatives ? selectedByKey.get(key) === food.id : false,
    };
  });
}

async function cacheOpenFoodFactsProducts(userId: string, results: Awaited<ReturnType<typeof searchOpenFoodFacts>>) {
  const now = new Date();
  const existing = await db.food.findMany({
    where: { barcode: { in: results.map((result) => result.barcode) }, source: "OPEN_FOOD_FACTS" },
    include: { portions: true, favorites: { where: { userId }, select: { userId: true } } },
  });
  const freshByBarcode = new Map(existing
    .filter((food) => !food.sourceExpiresAt || food.sourceExpiresAt > now)
    .map((food) => [food.barcode, food]));
  return Promise.all(results.map((result) => {
    const fresh = freshByBarcode.get(result.barcode);
    if (fresh) return fresh;
    const { barcode, sourceReference, ...nutrition } = result;
    return db.food.upsert({
      where: { barcode_source: { barcode, source: "OPEN_FOOD_FACTS" } },
      create: {
        ...nutrition,
        barcode,
        source: "OPEN_FOOD_FACTS",
        sourceReference,
        sourceFetchedAt: now,
        sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000),
      },
      update: {
        ...nutrition,
        sourceReference,
        sourceFetchedAt: now,
        sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000),
      },
      include: { portions: true, favorites: { where: { userId }, select: { userId: true } } },
    });
  }));
}

async function cacheUsdaProducts(userId: string, originalQuery: string, results: Awaited<ReturnType<typeof searchUsdaFoods>>) {
  const preset = externalQueryForFood(originalQuery);
  return Promise.all(results.map(async (result) => {
    const nutrition = {
      name: result.description.slice(0, 180),
      brand: "USDA FoodData Central",
      source: "USDA_FDC",
      sourceReference: result.sourceReference,
      sourceFetchedAt: new Date(),
      sourceExpiresAt: null,
      baseQuantity: result.baseQuantity,
      baseUnit: result.baseUnit,
      calories: result.calories,
      proteinGrams: result.proteinGrams,
      carbohydrateGrams: result.carbohydrateGrams,
      fatGrams: result.fatGrams,
      fiberGrams: result.fiberGrams,
    };
    const existing = await db.food.findFirst({ where: { source: "USDA_FDC", sourceReference: result.sourceReference }, select: { id: true } });
    let food = existing
      ? await db.food.update({ where: { id: existing.id }, data: nutrition, include: { portions: true, favorites: { where: { userId }, select: { userId: true } } } })
      : await db.food.create({ data: nutrition, include: { portions: true, favorites: { where: { userId }, select: { userId: true } } } });
    if (preset?.portionGrams && !food.portions.some((portion) => normalizeFoodName(portion.unit) === "unidade")) {
      await db.foodPortion.upsert({ where: { foodId_name: { foodId: food.id, name: "unidade" } }, create: { foodId: food.id, name: "unidade", unit: "unidade", quantityInBaseUnit: preset.portionGrams }, update: { unit: "unidade", quantityInBaseUnit: preset.portionGrams } });
      food = await db.food.findUniqueOrThrow({ where: { id: food.id }, include: { portions: true, favorites: { where: { userId }, select: { userId: true } } } });
    }
    return food;
  }));
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const scope = request.nextUrl.searchParams.get("scope");
  const searchExternal = request.nextUrl.searchParams.get("external") === "1";
  if (!scope && query.length < 2) return NextResponse.json({ foods: [] });

  if (scope === "recent") {
    const entries = await db.mealEntry.findMany({
      where: { foodId: { not: null }, meal: { dayLog: { userId: session.userId } }, food: { source: { not: "FATSECRET" }, calories: { gte: 0, lte: 1_000 }, OR: [{ ownerId: null }, { ownerId: session.userId }] } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { foodId: true },
    });
    const ids = [...new Set(entries.flatMap((entry) => entry.foodId ? [entry.foodId] : []))].slice(0, 20);
    const foods = await db.food.findMany({ where: { id: { in: ids } }, include: { portions: true, favorites: { where: { userId: session.userId }, select: { userId: true } } } });
    const byId = new Map(foods.map((food) => [food.id, food]));
    const ordered = ids.flatMap((id) => { const food = byId.get(id); return food ? [food] : []; });
    return NextResponse.json({ foods: await withConflictMetadata(session.userId, ordered) });
  }

  const foods = await db.food.findMany({
    where: {
      AND: [
        { OR: [{ ownerId: null }, { ownerId: session.userId }] },
        { source: { not: "FATSECRET" } },
        { calories: { gte: 0, lte: 1_000 } },
        scope === "favorites" ? { favorites: { some: { userId: session.userId } } } : {},
        query.length >= 2 ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { brand: { contains: query, mode: "insensitive" } }] } : {},
      ],
    },
    include: { portions: true, favorites: { where: { userId: session.userId }, select: { userId: true } } },
    orderBy: [{ ownerId: "desc" }, { name: "asc" }],
    take: 30,
  });
  let externalSearchUnavailable = false;
  let externalFoods: SearchFood[] = [];
  if (!scope && searchExternal && query.length >= 2) {
    const preset = externalQueryForFood(query);
    const [usda, openFoodFacts] = await Promise.allSettled([
      searchUsdaFoods(preset?.query ?? query),
      searchOpenFoodFacts(query),
    ]);
    const cached = await Promise.all([
      usda.status === "fulfilled" ? cacheUsdaProducts(session.userId, query, usda.value) : Promise.resolve([]),
      openFoodFacts.status === "fulfilled" ? cacheOpenFoodFactsProducts(session.userId, openFoodFacts.value) : Promise.resolve([]),
    ]);
    externalFoods = cached.flat();
    externalSearchUnavailable = usda.status === "rejected" && openFoodFacts.status === "rejected";
  }
  const merged = new Map([...foods, ...externalFoods].map((food) => [food.id, food]));
  return NextResponse.json({
    foods: await withConflictMetadata(session.userId, [...merged.values()].slice(0, 30)),
    externalSearchUnavailable,
    canSearchExternal: !scope && !searchExternal && query.length >= 2,
  });
}
