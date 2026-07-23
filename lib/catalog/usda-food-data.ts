import { z } from "zod";
import { usdaFoodDataPolicy } from "@/lib/integrations/provider-policy";
import { resilientProviderFetch } from "@/lib/integrations/resilient-fetch";

const nutrientSchema = z.object({
  nutrientId: z.coerce.number().optional(),
  nutrientName: z.string().optional(),
  unitName: z.string().optional(),
  value: z.coerce.number().optional(),
});

const searchSchema = z.object({
  foods: z.array(z.object({
    fdcId: z.coerce.number(),
    description: z.string().min(1),
    dataType: z.string().optional(),
    foodNutrients: z.array(nutrientSchema).default([]),
  })).default([]),
});

export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string | null;
  baseQuantity: 100;
  baseUnit: "g";
  calories: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sourceReference: string;
};

function nutrientValue(
  nutrients: z.infer<typeof nutrientSchema>[],
  ids: number[],
  expectedUnit?: string,
) {
  const match = ids.flatMap((id) => nutrients.filter((item) => item.nutrientId === id))
    .find((item) => item.value !== undefined && (!expectedUnit || item.unitName?.toUpperCase() === expectedUnit));
  return match?.value !== undefined && Number.isFinite(match.value) ? match.value : null;
}

export function normalizeUsdaFoodSearch(input: unknown): UsdaFood[] {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.foods.flatMap((food) => {
    const calories = nutrientValue(food.foodNutrients, [1008, 2047, 2048], "KCAL");
    if (calories === null || calories < 0 || calories > 1_000) return [];
    return [{
      fdcId: food.fdcId,
      description: food.description,
      dataType: food.dataType ?? null,
      baseQuantity: 100 as const,
      baseUnit: "g" as const,
      calories,
      proteinGrams: nutrientValue(food.foodNutrients, [1003]),
      carbohydrateGrams: nutrientValue(food.foodNutrients, [1005]),
      fatGrams: nutrientValue(food.foodNutrients, [1004]),
      fiberGrams: nutrientValue(food.foodNutrients, [1079]),
      sourceReference: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients`,
    }];
  });
}

export async function searchUsdaFoods(query: string) {
  const apiKey = process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY";
  const response = await resilientProviderFetch(
    "USDA_FOOD_DATA_SEARCH",
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `EasyFit/0.1 (${process.env.APP_URL ?? "local-development"}) - diet-import`,
      },
      body: JSON.stringify({
        query,
        pageSize: 6,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
      }),
    },
    usdaFoodDataPolicy(),
  );
  if (!response.ok) throw new Error(`USDA FoodData Central search failed with status ${response.status}.`);
  return normalizeUsdaFoodSearch(await response.json());
}
