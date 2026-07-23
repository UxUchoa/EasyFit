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

describe("barcode route", () => {
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

  it("returns the current Open Food Facts v3 olive oil payload", async () => {
    const gtin = "5601216120152";
    mocks.providerFetch.mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      product: {
        code: gtin,
        product_name: "AZEITE EXT VIRGEM ANDORINHA",
        brands: "ANDORINHA",
        product_quantity: 500,
        product_quantity_unit: "ml",
        serving_quantity: 13,
        nutriments: {},
        nutrition: {
          aggregated_set: {
            per: "100ml",
            nutrients: {
              "energy-kcal": { value: 830.769, value_computed: 108, unit: "kcal" },
              proteins: { value: 0, unit: "g" },
              carbohydrates: { value: 0, unit: "g" },
              fat: { value: 92.3077, unit: "g" },
            },
          },
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await lookupBarcode(
      new NextRequest(`http://localhost:3000/api/barcode/${gtin}`),
      { params: Promise.resolve({ gtin }) },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.food).toMatchObject({
      name: "AZEITE EXT VIRGEM ANDORINHA",
      barcode: gtin,
      source: "OPEN_FOOD_FACTS",
      baseQuantity: 100,
      baseUnit: "ml",
      calories: 830.769,
      fatGrams: 92.3077,
    });
    expect(mocks.providerFetch).toHaveBeenCalledTimes(1);
  });
});
