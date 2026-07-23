import { describe, expect, it } from "vitest";
import { aggregateNutrition, calculateEntryNutrition } from "./nutrition";

const food = {
  baseQuantity: 100,
  baseUnit: "g",
  calories: 200,
  proteinGrams: 10,
  carbohydrateGrams: 30,
  fatGrams: 4,
  portions: [{ name: "fatia", unit: "fatia", quantityInBaseUnit: 25 }],
};

describe("nutrition normalization", () => {
  it("scales nutrients in the base unit", () => {
    expect(calculateEntryNutrition(food, 50, "g")).toEqual({
      calories: 100,
      proteinGrams: 5,
      carbohydrateGrams: 15,
      fatGrams: 2,
    });
  });

  it("converts compatible metric units", () => {
    expect(calculateEntryNutrition(food, 0.1, "kg")?.calories).toBe(200);
  });

  it("converts declared portions and rejects unknown units", () => {
    expect(calculateEntryNutrition(food, 2, "fatia")?.calories).toBe(100);
    expect(calculateEntryNutrition(food, 1, "copo")).toBeNull();
  });

  it("marks aggregate macros incomplete instead of inventing values", () => {
    expect(
      aggregateNutrition([
        { calories: 100, proteinGrams: 5, carbohydrateGrams: 15, fatGrams: 2 },
        { calories: 80, proteinGrams: null, carbohydrateGrams: null, fatGrams: null },
      ]),
    ).toEqual({
      calories: 180,
      proteinGrams: 5,
      carbohydrateGrams: 15,
      fatGrams: 2,
      macrosComplete: false,
    });
  });
});
