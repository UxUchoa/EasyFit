import { describe, expect, it } from "vitest";
import { logicalDateKey, parseLogicalDate } from "./date";

describe("logical day", () => {
  it("parses only real ISO calendar dates", () => {
    expect(parseLogicalDate("2026-07-22")?.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(parseLogicalDate("2026-02-30")).toBeNull();
    expect(parseLogicalDate("22/07/2026")).toBeNull();
  });

  it("uses the profile timezone", () => {
    expect(logicalDateKey(new Date("2026-07-23T01:30:00Z"), "America/Sao_Paulo")).toBe("2026-07-22");
  });

  it("applies the configured closing offset", () => {
    expect(logicalDateKey(new Date("2026-07-22T08:30:00Z"), "America/Sao_Paulo", 360)).toBe("2026-07-21");
  });
});
