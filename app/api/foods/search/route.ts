import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { Prisma } from '@prisma/client';
import { foodConflictGroups, foodConflictKey } from '@/lib/catalog/conflicts';
import { searchOpenFoodFacts } from '@/lib/catalog/open-food-facts-search';

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
      ...food,
      favorite: food.favorites.length > 0,
      favorites: undefined,
      conflictKey: alternatives ? key : null,
      conflictSize: alternatives?.length ?? 0,
      preferredSource: alternatives ? selectedByKey.get(key) === food.id : false,
    };
  });
}

async function cacheOpenFoodFactsProducts(userId: string, results: Awaited<ReturnType<typeof searchOpenFoodFacts>>) {
  const now = new Date();
  return Promise.all(results.map((result) => {
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

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const scope = request.nextUrl.searchParams.get("scope");
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
  if (!scope && query.length >= 2) {
    try {
      const results = await searchOpenFoodFacts(query);
      externalFoods = await cacheOpenFoodFactsProducts(session.userId, results);
    } catch {
      externalSearchUnavailable = true;
    }
  }
  const merged = new Map([...foods, ...externalFoods].map((food) => [food.id, food]));
  return NextResponse.json({
    foods: await withConflictMetadata(session.userId, [...merged.values()].slice(0, 30)),
    externalSearchUnavailable,
  });
}
