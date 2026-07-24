import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  foodFindMany: vi.fn(),
  foodFindFirst: vi.fn(),
  foodCreate: vi.fn(),
  foodUpdate: vi.fn(),
  foodFindUniqueOrThrow: vi.fn(),
  portionCreate: vi.fn(),
  usdaSearch: vi.fn(),
  offSearch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { food: {
  findMany: mocks.foodFindMany,
  findFirst: mocks.foodFindFirst,
  create: mocks.foodCreate,
  update: mocks.foodUpdate,
  findUniqueOrThrow: mocks.foodFindUniqueOrThrow,
  upsert: vi.fn(),
}, foodPortion: { create: mocks.portionCreate } } }));
vi.mock("@/lib/catalog/usda-food-data", () => ({ searchUsdaFoods: mocks.usdaSearch }));
vi.mock("@/lib/catalog/open-food-facts-search", () => ({ searchOpenFoodFacts: mocks.offSearch }));

import { catalogSearchTermsForFood, externalQueryForFood, extractDeclaredCalories, foodNameSimilarity, normalizeFoodName, resolveImportFoodNames } from "./food-resolver";

describe("diet import food resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.foodFindMany.mockResolvedValue([]);
    mocks.foodFindFirst.mockResolvedValue(null);
    mocks.usdaSearch.mockResolvedValue([{ fdcId: 1, description: "Bananas, raw", dataType: "Foundation", baseQuantity: 100, baseUnit: "g", calories: 89, proteinGrams: 1.1, carbohydrateGrams: 22.8, fatGrams: 0.3, fiberGrams: 2.6, sourceReference: "https://fdc.example/1" }]);
    mocks.foodCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "food-usda", ownerId: null, barcode: null, sourceExpiresAt: null, createdAt: new Date(), updatedAt: new Date(), portions: [], ...data }));
    mocks.offSearch.mockResolvedValue([]);
  });

  it("normalizes accents and punctuation for Portuguese catalog matching", () => {
    expect(normalizeFoodName("  Queijo MUÇARELA — fatiado ")).toBe("queijo mucarela fatiado");
    expect(foodNameSimilarity("Arroz cozido", "Arroz cozido branco")).toBeGreaterThanOrEqual(0.9);
  });

  it("maps common Brazilian descriptions to generic USDA searches", () => {
    expect(externalQueryForFood("Peito de frango grelhado")?.query).toContain("chicken breast");
    expect(externalQueryForFood("Ovo")?.portionGrams).toBe(50);
    expect(externalQueryForFood("Ovo cozido")?.portionGrams).toBe(50);
    expect(catalogSearchTermsForFood("Ovo")).toEqual(["Ovo", "egg"]);
    expect(externalQueryForFood("Alimento desconhecido")).toBeNull();
  });

  it("understands an explicit calorie budget in the item name", () => {
    expect(extractDeclaredCalories("Refeição livre — orçamento aproximado de 960 kcal")).toBe(960);
    expect(extractDeclaredCalories("Banana")).toBeNull();
  });

  it("resolves a repeated weekly food only once and reuses the result", async () => {
    const resolved = await resolveImportFoodNames("user-1", Array.from({ length: 104 }, () => "Banana"));
    expect(resolved.get("banana")).toMatchObject({ foodId: "food-usda", source: "USDA_FDC", confidence: 0.96 });
    expect(mocks.usdaSearch).toHaveBeenCalledTimes(1);
    expect(mocks.foodCreate).toHaveBeenCalledTimes(1);
  });

  it("has automatic strategies for every unique food in the attached weekly plan", () => {
    const names = ["Arroz cozido", "Azeite de oliva", "Bacon", "Banana", "Carne bovina magra grelhada", "Maçã", "Ovo", "Pão", "Peito de frango grelhado", "Peito de peru", "Peixe grelhado", "Queijo coalho", "Queijo muçarela", "Salada crua variada", "Whey protein"];
    expect(names.every((name) => externalQueryForFood(name))).toBe(true);
    expect(extractDeclaredCalories("Refeição livre — orçamento aproximado de 960 kcal")).toBe(960);
  });
});
