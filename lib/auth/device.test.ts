import { describe, expect, it } from "vitest";
import { approximateLocation, describeUserAgent } from "./device";

describe("session presentation", () => {
  it("describes common browsers without exposing the full user agent", () => {
    expect(describeUserAgent("Mozilla/5.0 (iPhone) AppleWebKit Safari/605.1")).toBe("Safari em iPhone");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0")).toBe("Chrome em Windows");
  });

  it("uses only coarse platform location fields", () => {
    expect(approximateLocation({ city: "São Paulo", region: "SP", countryCode: "BR" })).toBe("São Paulo, SP, BR");
    expect(approximateLocation({})).toBe("Localização aproximada indisponível");
  });
});
