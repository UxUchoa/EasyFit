import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () => ({ userId: "user-1" }),
}));
vi.mock("@/lib/db", () => ({
  db: { food: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));
vi.mock("@/lib/integrations/resilient-fetch", () => ({
  ProviderGateError: class ProviderGateError extends Error {},
  resilientProviderFetch: mocks.providerFetch,
}));
vi.mock("@/lib/observability/logger", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/observability/metrics", () => ({ recordOperationalMetricSafely: vi.fn() }));

import { GET as lookupBarcode } from "@/app/api/barcode/[gtin]/route";

describe("barcode route Brazilian fallback", () => {
  beforeEach(() => {
    mocks.findMany.mockReset().mockResolvedValue([]);
    mocks.providerFetch.mockReset().mockResolvedValue(new Response(null, { status: 404 }));
    mocks.upsert.mockReset().mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: "food-br-1",
      portions: [],
      ...create,
    }));
  });

  it("returns the national apple from the TACO reference after Open Food Facts misses", async () => {
    const gtin = "03400000675982";
    const response = await lookupBarcode(
      new NextRequest(`http://localhost:3000/api/barcode/${gtin}`),
      { params: Promise.resolve({ gtin }) },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.food).toMatchObject({
      name: "Maçã nacional",
      barcode: gtin,
      source: "TACO_BR",
      calories: 56,
      carbohydrateGrams: 15.2,
    });
    expect(result.warning).toContain("referência");
    expect(mocks.providerFetch).toHaveBeenCalledTimes(2);
  });
});
