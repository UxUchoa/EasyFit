import { describe, expect, it } from "vitest";
import { ageInTimeZone, birthDateIsAllowed, birthDateSchema } from "./birth-date";

describe("birth date handling", () => {
  it("accepts only a real date-only ISO value", () => {
    expect(birthDateSchema.parse("2000-02-29").toISOString()).toBe("2000-02-29T00:00:00.000Z");
    expect(birthDateSchema.safeParse("2001-02-29").success).toBe(false);
    expect(birthDateSchema.safeParse("2000-02-29T00:00:00Z").success).toBe(false);
    expect(birthDateSchema.safeParse("02/29/2000").success).toBe(false);
  });

  it("calculates the birthday using the user's calendar day instead of UTC", () => {
    const birthDate = birthDateSchema.parse("2010-07-23");
    const instant = new Date("2026-07-23T01:30:00.000Z");
    expect(ageInTimeZone(birthDate, "America/Sao_Paulo", instant)).toBe(15);
    expect(ageInTimeZone(birthDate, "Europe/Lisbon", instant)).toBe(16);
    expect(birthDateIsAllowed(birthDate, "America/Sao_Paulo", instant)).toBe(false);
    expect(birthDateIsAllowed(birthDate, "Europe/Lisbon", instant)).toBe(true);
  });
});
