import { z } from "zod";

const nutrientSchema = z.object({
  value: z.coerce.number().optional(),
  value_computed: z.coerce.number().optional(),
  unit: z.string().optional(),
});

const responseSchema = z.object({
  product: z
    .object({
      code: z.string().optional(),
      product_name: z.string().optional(),
      brands: z.union([z.string(), z.array(z.string())]).optional(),
      serving_quantity: z.coerce.number().optional(),
      product_quantity: z.coerce.number().optional(),
      product_quantity_unit: z.string().optional(),
      nutrition: z
        .object({
          aggregated_set: z
            .object({
              per: z.string().optional(),
              nutrients: z.record(z.string(), nutrientSchema).optional(),
            })
            .optional(),
        })
        .optional(),
      nutriments: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  status: z.coerce.number().optional(),
});

function finite(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nutrientValue(
  nutrients: Record<string, z.infer<typeof nutrientSchema>> | undefined,
  key: string,
) {
  const nutrient = nutrients?.[key];
  return finite(nutrient?.value_computed ?? nutrient?.value);
}

export type NormalizedOffProduct = {
  name: string;
  brand: string | null;
  baseQuantity: number;
  baseUnit: string;
  calories: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
};

export function normalizeOpenFoodFactsProduct(input: unknown): NormalizedOffProduct | null {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success || !parsed.data.product?.product_name) return null;
  const product = parsed.data.product;
  const set = product.nutrition?.aggregated_set;
  const nutrients = set?.nutrients;
  const legacy = product.nutriments ?? {};
  const calories =
    nutrientValue(nutrients, "energy-kcal") ?? finite(legacy["energy-kcal_100g"]);
  if (calories === null || calories < 0 || calories > 1_000) return null;

  const per = set?.per;
  const isServing = per === "serving";
  const baseQuantity = isServing
    ? product.serving_quantity ?? product.product_quantity ?? 1
    : 100;
  const baseUnit = isServing ? product.product_quantity_unit ?? "g" : "g";
  const brand = Array.isArray(product.brands)
    ? product.brands.join(", ")
    : product.brands ?? null;

  return {
    name: product.product_name!,
    brand,
    baseQuantity,
    baseUnit,
    calories,
    proteinGrams: nutrientValue(nutrients, "proteins") ?? finite(legacy.proteins_100g),
    carbohydrateGrams:
      nutrientValue(nutrients, "carbohydrates") ?? finite(legacy.carbohydrates_100g),
    fatGrams: nutrientValue(nutrients, "fat") ?? finite(legacy.fat_100g),
    fiberGrams: nutrientValue(nutrients, "fiber") ?? finite(legacy.fiber_100g),
  };
}
