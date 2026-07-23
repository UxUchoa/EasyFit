import { describe, expect, it } from "vitest";
import { normalizeOpenFoodFactsProduct } from "./open-food-facts";

describe("Open Food Facts normalization", () => {
  it("normalizes the current v3 nutrition structure", () => {
    expect(
      normalizeOpenFoodFactsProduct({
        product: {
          product_name: "Aveia",
          brands: ["Marca A"],
          nutrition: {
            aggregated_set: {
              per: "100g",
              nutrients: {
                "energy-kcal": { value_computed: 380, unit: "kcal" },
                proteins: { value: 13, unit: "g" },
                carbohydrates: { value: 67, unit: "g" },
                fat: { value: 7, unit: "g" },
              },
            },
          },
        },
      }),
    ).toEqual({
      name: "Aveia",
      brand: "Marca A",
      baseQuantity: 100,
      baseUnit: "g",
      calories: 380,
      proteinGrams: 13,
      carbohydrateGrams: 67,
      fatGrams: 7,
      fiberGrams: null,
    });
  });

  it("accepts the documented legacy nutrient shape as a defensive fallback", () => {
    expect(
      normalizeOpenFoodFactsProduct({
        status: 1,
        product: {
          product_name: "Produto",
          nutriments: {
            "energy-kcal_100g": 120,
            proteins_100g: 3,
            carbohydrates_100g: 20,
            fat_100g: 2,
          },
        },
      })?.calories,
    ).toBe(120);
  });

  it("rejects products without a name or calorie basis", () => {
    expect(normalizeOpenFoodFactsProduct({ product: { product_name: "Sem tabela" } })).toBeNull();
  });
});
