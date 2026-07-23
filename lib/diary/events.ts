export const DIET_PLAN_APPLIED_EVENT = "easyfit:diet-plan-applied";

export type DietPlanAppliedDetail<TEntry = unknown> = {
  mealSlug: string;
  entries: TEntry[];
};
