import { describe, expect, it } from "vitest";
import { normalizeUsdaFoodSearch } from "./usda-food-data";

describe("USDA FoodData Central normalization", () => {
  it("extracts energy and macronutrients per 100 grams", () => {
    expect(normalizeUsdaFoodSearch({ foods: [{
      fdcId: 173423,
      description: "Egg, whole, cooked",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, unitName: "KCAL", value: 155 },
        { nutrientId: 1003, unitName: "G", value: 12.6 },
        { nutrientId: 1005, unitName: "G", value: 1.1 },
        { nutrientId: 1004, unitName: "G", value: 10.6 },
      ],
    }] })[0]).toMatchObject({
      fdcId: 173423,
      calories: 155,
      proteinGrams: 12.6,
      carbohydrateGrams: 1.1,
      fatGrams: 10.6,
      baseQuantity: 100,
      baseUnit: "g",
    });
  });

  it("accepts calculated Atwater energy and rejects results without calories", () => {
    expect(normalizeUsdaFoodSearch({ foods: [
      { fdcId: 1, description: "Foundation food", foodNutrients: [{ nutrientId: 2047, unitName: "KCAL", value: 120 }] },
      { fdcId: 2, description: "Incomplete food", foodNutrients: [{ nutrientId: 1003, unitName: "G", value: 2 }] },
    ] })).toHaveLength(1);
  });
});
