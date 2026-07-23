import { describe, expect, it } from "vitest";
import { diaryEntryResponse } from "./response";

describe("diary entry response", () => {
  it("returns only the compact client contract and converts numeric values", () => {
    const result = diaryEntryResponse({
      id: "entry-1",
      updatedAt: new Date("2026-07-23T18:00:00.000Z"),
      kind: "CONSUMED",
      quantity: "120.5",
      unit: "g",
      snapshotName: "Arroz",
      snapshotBrand: null,
      snapshotCalories: "156.65",
      snapshotProtein: "3.2",
      snapshotCarbohydrate: null,
      snapshotFat: "0.4",
      macrosComplete: false,
    });

    expect(result).toEqual({
      id: "entry-1",
      updatedAt: "2026-07-23T18:00:00.000Z",
      kind: "CONSUMED",
      name: "Arroz",
      brand: null,
      quantity: 120.5,
      unit: "g",
      calories: 156.65,
      proteinGrams: 3.2,
      carbohydrateGrams: null,
      fatGrams: 0.4,
      macrosComplete: false,
      revisions: [],
    });
  });
});
