import { describe, expect, it } from "vitest";
import { appendDietPlanSnapshotItem, dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate, mealSlugFromImportedLabel, removeDietPlanSnapshotItem, replaceDietPlanSnapshotFood, updateDietPlanSnapshotItem } from "./snapshot";

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

  it("recalculates a reviewed item using its original quantity and selected portion", () => {
    const reviewed = replaceDietPlanSnapshotFood(snapshot, "$[1]", {
      id: "egg",
      name: "Ovo inteiro cozido",
      source: "USDA_FDC",
      baseQuantity: 100,
      baseUnit: "g",
      calories: 155,
      proteinGrams: 12.6,
      carbohydrateGrams: 1.1,
      fatGrams: 10.6,
      portions: [],
    });
    expect(reviewed?.items[1].catalog).toMatchObject({ foodId: "egg", confidence: 1 });
    expect(reviewed?.items[1].nutrition?.calories).toBe(155);
  });

  it("supports unit portions when the nutrition base is grams", () => {
    const unitSnapshot = dietPlanSnapshotSchema.parse({ ...snapshot, items: [{ ...snapshot.items[1], quantity: 2, unit: "unidades" }] });
    const reviewed = replaceDietPlanSnapshotFood(unitSnapshot, "$[1]", {
      id: "egg",
      name: "Ovo inteiro cozido",
      source: "USDA_FDC",
      baseQuantity: 100,
      baseUnit: "g",
      calories: 155,
      proteinGrams: 12.6,
      carbohydrateGrams: 1.1,
      fatGrams: 10.6,
      portions: [{ name: "unidade", unit: "unidade", quantityInBaseUnit: 50 }],
    });
    expect(reviewed?.items[0].nutrition?.calories).toBe(155);
  });

  it("edits, appends and removes plan items without rebuilding the import", () => {
    const edited = updateDietPlanSnapshotItem(snapshot, "$[0]", { name: "Arroz integral", quantity: 150 });
    expect(edited?.items[0]).toMatchObject({ name: "Arroz integral", quantity: 150 });
    const addedItem = { ...snapshot.items[0], sourcePointer: "$.manual[1]", name: "Feijão" };
    const appended = appendDietPlanSnapshotItem(edited!, addedItem);
    expect(appended?.items).toHaveLength(3);
    const removed = removeDietPlanSnapshotItem(appended!, "$.manual[1]");
    expect(removed?.items.map((item) => item.name)).not.toContain("Feijão");
  });
});
