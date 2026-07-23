import { describe, expect, it } from "vitest";
import { dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate, mealSlugFromImportedLabel } from "./snapshot";

const snapshot = dietPlanSnapshotSchema.parse({ importJobId: "job", parserVersion: "v2", ignoredCount: 0, items: [
  { day: "Segunda-feira", meal: "Jantar — Refeição livre", name: "Arroz", quantity: 100, unit: "g", sourcePointer: "$[0]", catalog: null, nutrition: { calories: 130, proteinGrams: 2, carbohydrateGrams: 28, fatGrams: 0.3 } },
  { day: "Terça-feira", meal: "Almoço", name: "Banana", quantity: 100, unit: "g", sourcePointer: "$[1]", catalog: null, nutrition: null },
] });

describe("active diet snapshot", () => {
  it("selects the imported weekday using the logical date", () => {
    expect(itemsForDietDate(snapshot, "2026-07-27").map((item) => item.name)).toEqual(["Arroz"]);
    expect(itemsForDietDate(snapshot, "2026-07-28").map((item) => item.name)).toEqual(["Banana"]);
  });

  it("maps decorated meal labels to diary slots", () => {
    expect(mealSlugFromImportedLabel("Jantar — Refeição livre")).toBe("jantar");
    expect(groupDietItemsByMeal(snapshot.items)[0].slug).toBe("jantar");
  });
});
