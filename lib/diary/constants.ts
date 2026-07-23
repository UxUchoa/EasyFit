import type { MealKind } from "@prisma/client";

export const STANDARD_MEALS: ReadonlyArray<{
  slug: string;
  label: string;
  kind: MealKind;
  position: number;
}> = [
  { slug: "cafe-da-manha", label: "Café da manhã", kind: "BREAKFAST", position: 0 },
  { slug: "lanche-da-manha", label: "Lanche da manhã", kind: "MORNING_SNACK", position: 1 },
  { slug: "almoco", label: "Almoço", kind: "LUNCH", position: 2 },
  { slug: "lanche-da-tarde", label: "Lanche da tarde", kind: "AFTERNOON_SNACK", position: 3 },
  { slug: "jantar", label: "Jantar", kind: "DINNER", position: 4 },
  { slug: "ceia", label: "Ceia", kind: "SUPPER", position: 5 },
] as const;

export const MEAL_BY_SLUG = new Map(STANDARD_MEALS.map((meal) => [meal.slug, meal]));

export function mealLabel(slug: string, customName?: string | null) {
  return MEAL_BY_SLUG.get(slug)?.label ?? customName ?? "Refeição";
}
