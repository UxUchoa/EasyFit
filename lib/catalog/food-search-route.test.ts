import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  foodFindMany: vi.fn(),
  foodUpsert: vi.fn(),
  choiceFindMany: vi.fn(),
  entryFindMany: vi.fn(),
  externalSearch: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () => ({ userId: "user-1" }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    food: { findMany: mocks.foodFindMany, upsert: mocks.foodUpsert },
    foodSourceChoice: { findMany: mocks.choiceFindMany },
    mealEntry: { findMany: mocks.entryFindMany },
  },
}));
vi.mock("@/lib/catalog/open-food-facts-search", () => ({
  searchOpenFoodFacts: mocks.externalSearch,
}));

import { GET as searchFoods } from "@/app/api/foods/search/route";

const localFood = {
  id: "food-1",
  ownerId: null,
  name: "Arroz integral",
  brand: null,
  barcode: null,
  source: "TACO_BR",
  baseQuantity: 100,
  baseUnit: "g",
  calories: 124,
  proteinGrams: 2.6,
  carbohydrateGrams: 25.8,
  fatGrams: 1,
  portions: [],
  favorites: [],
};

describe("food search route", () => {
  beforeEach(() => {
    mocks.foodFindMany.mockReset();
    mocks.foodUpsert.mockReset();
    mocks.choiceFindMany.mockReset().mockResolvedValue([]);
    mocks.entryFindMany.mockReset().mockResolvedValue([]);
    mocks.externalSearch.mockReset().mockResolvedValue([]);
  });

  it("returns saved results without waiting for the external provider", async () => {
    mocks.foodFindMany.mockResolvedValue([localFood]);

    const response = await searchFoods(new NextRequest("http://localhost:3000/api/foods/search?q=arroz"));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.foods).toEqual([expect.objectContaining({ id: "food-1", name: "Arroz integral", calories: "124" })]);
    expect(result.canSearchExternal).toBe(true);
    expect(mocks.externalSearch).not.toHaveBeenCalled();
  });

  it("uses the external provider only when explicitly requested", async () => {
    mocks.foodFindMany.mockResolvedValue([]);

    const response = await searchFoods(new NextRequest("http://localhost:3000/api/foods/search?q=aveia&external=1"));

    expect(response.status).toBe(200);
    expect(mocks.externalSearch).toHaveBeenCalledWith("aveia");
  });
});
