import { z } from "zod";
import { calculateEntryNutrition, type FoodForCalculation } from "@/lib/diary/nutrition";
import { normalizeFoodName } from "./food-resolver";

const nutritionSchema = z.object({
  calories: z.number().min(0).max(100_000),
  proteinGrams: z.number().min(0).max(100_000).nullable(),
  carbohydrateGrams: z.number().min(0).max(100_000).nullable(),
  fatGrams: z.number().min(0).max(100_000).nullable(),
});

const itemSchema = z.object({
  day: z.string(),
  meal: z.string(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  sourcePointer: z.string(),
  catalog: z.object({
    foodId: z.string(),
    name: z.string().nullable(),
    source: z.string().nullable(),
    confidence: z.number().nullable(),
  }).nullable(),
  nutrition: nutritionSchema.nullable().optional().default(null),
});

export const dietPlanSnapshotSchema = z.object({
  importJobId: z.string(),
  parserVersion: z.string(),
  ignoredCount: z.number().int().min(0),
  items: z.array(itemSchema),
});

export type DietPlanSnapshot = z.infer<typeof dietPlanSnapshotSchema>;
export type DietPlanSnapshotItem = DietPlanSnapshot["items"][number];

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export function itemsForDietDate(snapshot: DietPlanSnapshot, logicalDate: string) {
  const date = new Date(`${logicalDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return [];
  const weekday = WEEKDAYS[date.getUTCDay()];
  return snapshot.items.filter((item) => normalizeFoodName(item.day).startsWith(weekday));
}

export function mealSlugFromImportedLabel(label: string) {
  const normalized = normalizeFoodName(label);
  if (normalized.startsWith("cafe da manha")) return "cafe-da-manha";
  if (normalized.startsWith("lanche da manha")) return "lanche-da-manha";
  if (normalized.startsWith("almoco")) return "almoco";
  if (normalized.startsWith("lanche da tarde")) return "lanche-da-tarde";
  if (normalized.startsWith("jantar")) return "jantar";
  if (normalized.startsWith("ceia")) return "ceia";
  return null;
}

export function groupDietItemsByMeal(items: DietPlanSnapshotItem[]) {
  const groups = new Map<string, DietPlanSnapshotItem[]>();
  for (const item of items) groups.set(item.meal, [...(groups.get(item.meal) ?? []), item]);
  return [...groups].map(([label, mealItems]) => ({ label, slug: mealSlugFromImportedLabel(label), items: mealItems }));
}

export function replaceDietPlanSnapshotFood(
  snapshot: DietPlanSnapshot,
  sourcePointer: string,
  food: FoodForCalculation & { id: string; name: string; source: string },
) {
  const target = snapshot.items.find((item) => item.sourcePointer === sourcePointer);
  if (!target) return null;
  const nutrition = calculateEntryNutrition(food, target.quantity, target.unit);
  if (!nutrition) return null;
  return {
    ...snapshot,
    items: snapshot.items.map((item) => item.sourcePointer === sourcePointer ? {
      ...item,
      catalog: { foodId: food.id, name: food.name, source: food.source, confidence: 1 },
      nutrition,
    } : item),
  } satisfies DietPlanSnapshot;
}

export function updateDietPlanSnapshotItem(
  snapshot: DietPlanSnapshot,
  sourcePointer: string,
  changes: Partial<Pick<DietPlanSnapshotItem, "name" | "quantity" | "unit" | "nutrition">>,
) {
  if (!snapshot.items.some((item) => item.sourcePointer === sourcePointer)) return null;
  return {
    ...snapshot,
    items: snapshot.items.map((item) => item.sourcePointer === sourcePointer ? { ...item, ...changes } : item),
  } satisfies DietPlanSnapshot;
}

export function removeDietPlanSnapshotItem(snapshot: DietPlanSnapshot, sourcePointer: string) {
  if (!snapshot.items.some((item) => item.sourcePointer === sourcePointer)) return null;
  return { ...snapshot, items: snapshot.items.filter((item) => item.sourcePointer !== sourcePointer) } satisfies DietPlanSnapshot;
}

export function appendDietPlanSnapshotItem(snapshot: DietPlanSnapshot, item: DietPlanSnapshotItem) {
  if (snapshot.items.some((candidate) => candidate.sourcePointer === item.sourcePointer)) return null;
  return { ...snapshot, items: [...snapshot.items, item] } satisfies DietPlanSnapshot;
}
