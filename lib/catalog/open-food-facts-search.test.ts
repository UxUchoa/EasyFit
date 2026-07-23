import { describe, expect, it } from "vitest";

import { normalizeOpenFoodFactsSearch } from "./open-food-facts-search";

describe("Open Food Facts text search normalization", () => {
  it("keeps valid products with nutritional values and removes duplicates", () => {
    const result = normalizeOpenFoodFactsSearch({
      products: [
        {
          code: "7891000100103",
          product_name: "Aveia em flocos",
          brands: "Marca Brasil",
          nutriments: {
            "energy-kcal_100g": 380,
            proteins_100g: 13,
            carbohydrates_100g: 67,
            fat_100g: 7,
          },
        },
        {
          code: "7891000100103",
          product_name: "Aveia em flocos",
          nutriments: { "energy-kcal_100g": 381 },
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      barcode: "7891000100103",
      name: "Aveia em flocos",
      calories: 381,
      baseQuantity: 100,
      baseUnit: "g",
    });
  });

  it("ignores invalid barcodes and products without a nutritional basis", () => {
    expect(normalizeOpenFoodFactsSearch({
      products: [
        { code: "123", product_name: "Código inválido", nutriments: { "energy-kcal_100g": 10 } },
        { code: "7891000100103", product_name: "Sem tabela" },
        { code: "7898994939757", product_name: "Calorias impossíveis", nutriments: { "energy-kcal_100g": 7_220 } },
      ],
    })).toEqual([]);
  });

  it("accepts the Search-a-licious hits response", () => {
    expect(normalizeOpenFoodFactsSearch({
      hits: [{
        code: "7898994939757",
        product_name: "Bebida à base de aveia",
        brands: ["Aveia"],
        nutriments: { "energy-kcal_100g": 49.5, proteins_100g: 2.05 },
      }],
    })[0]).toMatchObject({
      barcode: "7898994939757",
      name: "Bebida à base de aveia",
      calories: 49.5,
      proteinGrams: 2.05,
    });
  });

});
