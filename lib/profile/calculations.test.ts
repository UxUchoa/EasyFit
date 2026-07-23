import { describe, expect, it } from "vitest";
import {
  ageOnDate,
  calculateBmi,
  calculateBmr,
  calculateTdee,
  suggestCalorieTarget,
  suggestMacros,
} from "./calculations";

const baseInput = {
  birthDate: new Date("1996-08-10T00:00:00.000Z"),
  biologicalSex: "male" as const,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate" as const,
  referenceDate: new Date("2026-07-22T00:00:00.000Z"),
};

describe("profile estimates", () => {
  it("calculates age without rounding before the birthday", () => {
    expect(ageOnDate(baseInput.birthDate, baseInput.referenceDate)).toBe(29);
    expect(ageOnDate(baseInput.birthDate, new Date("2026-08-10T00:00:00.000Z"))).toBe(30);
  });

  it("uses Mifflin-St Jeor for BMR", () => {
    expect(calculateBmr(baseInput)).toBeCloseTo(1785, 0);
  });

  it("applies the selected activity factor to estimated expenditure", () => {
    expect(calculateTdee(baseInput)).toBeCloseTo(2766.75, 2);
  });

  it("calculates BMI from metric units", () => {
    expect(calculateBmi(80, 180)).toBeCloseTo(24.69, 2);
  });

  it("builds transparent calorie and macro suggestions", () => {
    expect(suggestCalorieTarget(2500, "lose")).toBe(2125);
    expect(suggestCalorieTarget(2500, "maintain")).toBe(2500);
    expect(suggestCalorieTarget(2500, "gain")).toBe(2750);
    expect(suggestMacros(2200, 80)).toEqual({
      proteinGrams: 128,
      carbohydrateGrams: 278,
      fatGrams: 64,
    });
  });
});
