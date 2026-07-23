import { describe, expect, it } from "vitest";
import { isRecentlyReauthenticated, REAUTHENTICATION_WINDOW_MS } from "./reauthentication";

describe("recent reauthentication", () => {
  const now = new Date("2026-07-22T18:00:00.000Z");

  it("accepts a verification inside the short window", () => {
    expect(isRecentlyReauthenticated({ reauthenticatedAt: new Date(now.getTime() - 60_000) }, now)).toBe(true);
  });

  it("rejects absent or expired verification", () => {
    expect(isRecentlyReauthenticated({ reauthenticatedAt: null }, now)).toBe(false);
    expect(
      isRecentlyReauthenticated(
        { reauthenticatedAt: new Date(now.getTime() - REAUTHENTICATION_WINDOW_MS - 1) },
        now,
      ),
    ).toBe(false);
  });
});
