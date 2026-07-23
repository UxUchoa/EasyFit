import { describe, expect, it } from "vitest";
import { gtinLookupVariants, isSupportedGtin } from "./gtin";

describe("GTIN validation", () => {
  it("accepts EAN-8, UPC-A, EAN-13 and GTIN-14 with valid check digits", () => {
    expect(isSupportedGtin("96385074")).toBe(true);
    expect(isSupportedGtin("036000291452")).toBe(true);
    expect(isSupportedGtin("7891000100103")).toBe(true);
    expect(isSupportedGtin("03400000675982")).toBe(true);
  });

  it("rejects unsupported lengths, non-digits and invalid check digits", () => {
    expect(isSupportedGtin("123456")).toBe(false);
    expect(isSupportedGtin("7891000100104")).toBe(false);
    expect(isSupportedGtin("7891000A00103")).toBe(false);
    expect(isSupportedGtin("03400000675983")).toBe(false);
  });

  it("also looks up the EAN-13 representation of a zero-prefixed GTIN-14", () => {
    expect(gtinLookupVariants("03400000675982")).toEqual(["03400000675982", "3400000675982"]);
    expect(gtinLookupVariants("7891000100103")).toEqual(["7891000100103"]);
  });
});
