import { describe, expect, it } from "vitest";
import {
  BRAZILIAN_REFERENCE_SOURCE,
  findBrazilianFoodReference,
} from "./brazilian-foods";

describe("Brazilian reference food catalog", () => {
  it("maps the national apple GTIN-14 and its EAN-13 representation", () => {
    const gtin14 = findBrazilianFoodReference("03400000675982");
    const ean13 = findBrazilianFoodReference("3400000675982");

    expect(gtin14).toMatchObject({ name: "Maçã nacional", calories: 56, baseQuantity: 100, baseUnit: "g" });
    expect(ean13).toEqual(gtin14);
    expect(BRAZILIAN_REFERENCE_SOURCE).toBe("TACO_BR");
  });

  it("does not guess an unknown GTIN", () => {
    expect(findBrazilianFoodReference("7891000100103")).toBeNull();
  });
});
