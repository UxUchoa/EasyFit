import { describe, expect, it } from "vitest";
import { calendarDateKey, isSupportedTimeZone, logicalDateKey, parseLogicalDate, shiftLogicalDate, zonedDateTimeParts } from "./date";

describe("logical day", () => {
  it("parses only real ISO calendar dates", () => {
    expect(parseLogicalDate("2026-07-22")?.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(parseLogicalDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(parseLogicalDate("2026-02-30")).toBeNull();
    expect(parseLogicalDate("2025-02-29")).toBeNull();
    expect(parseLogicalDate("0000-01-01")).toBeNull();
    expect(parseLogicalDate("22/07/2026")).toBeNull();
  });

  it("shifts calendar dates across month, year and leap-day boundaries", () => {
    expect(shiftLogicalDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftLogicalDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftLogicalDate("2024-02-29", 1)).toBe("2024-03-01");
    expect(shiftLogicalDate("2026-02-30", 1)).toBeNull();
  });

  it("uses the profile timezone", () => {
    expect(logicalDateKey(new Date("2026-07-23T01:30:00Z"), "America/Sao_Paulo")).toBe("2026-07-22");
  });

  it("applies the configured closing offset", () => {
    expect(logicalDateKey(new Date("2026-07-22T08:30:00Z"), "America/Sao_Paulo", 360)).toBe("2026-07-21");
    expect(logicalDateKey(new Date("2026-07-22T09:00:00Z"), "America/Sao_Paulo", 360)).toBe("2026-07-22");
  });

  it("uses local wall-clock time across a daylight-saving transition", () => {
    expect(logicalDateKey(new Date("2026-03-08T09:30:00Z"), "America/New_York", 360)).toBe("2026-03-07");
    expect(logicalDateKey(new Date("2026-03-08T10:30:00Z"), "America/New_York", 360)).toBe("2026-03-08");
  });

  it("exposes deterministic local calendar and clock parts", () => {
    expect(calendarDateKey(new Date("2026-01-01T10:30:00Z"), "Pacific/Kiritimati")).toBe("2026-01-02");
    expect(zonedDateTimeParts(new Date("2026-07-26T15:45:00Z"), "America/Sao_Paulo")).toEqual({
      dateKey: "2026-07-26",
      weekday: 0,
      hour: 12,
      minute: 45,
    });
    expect(isSupportedTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isSupportedTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(calendarDateKey(new Date("2026-07-23T01:30:00Z"), "Mars/Olympus_Mons")).toBe("2026-07-22");
  });
});
