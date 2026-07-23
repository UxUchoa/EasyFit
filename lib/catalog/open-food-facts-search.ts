import { z } from "zod";
import { isSupportedGtin } from "@/lib/catalog/gtin";
import { normalizeOpenFoodFactsProduct, type NormalizedOffProduct } from "@/lib/catalog/open-food-facts";
import { openFoodFactsSearchPolicy } from "@/lib/integrations/provider-policy";
import { resilientProviderFetch } from "@/lib/integrations/resilient-fetch";

const searchResponseSchema = z.object({
  hits: z.array(z.record(z.string(), z.unknown())).optional(),
  products: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type OpenFoodFactsSearchProduct = NormalizedOffProduct & {
  barcode: string;
  sourceReference: string;
};

export function normalizeOpenFoodFactsSearch(input: unknown): OpenFoodFactsSearchProduct[] {
  const parsed = searchResponseSchema.safeParse(input);
  if (!parsed.success) return [];
  const products = new Map<string, OpenFoodFactsSearchProduct>();
  for (const product of parsed.data.hits ?? parsed.data.products ?? []) {
    const barcode = typeof product.code === "string" ? product.code.trim() : "";
    if (!isSupportedGtin(barcode)) continue;
    const normalized = normalizeOpenFoodFactsProduct({ product });
    if (!normalized) continue;
    products.set(barcode, {
      ...normalized,
      barcode,
      sourceReference: `https://world.openfoodfacts.org/product/${barcode}`,
    });
  }
  return [...products.values()];
}

async function fetchOpenFoodFactsProducts(url: URL) {
  const response = await resilientProviderFetch(
    "OPEN_FOOD_FACTS_SEARCH",
    url.toString(),
    {
      headers: {
        "User-Agent": `EasyFit/0.1 (${process.env.OPEN_FOOD_FACTS_CONTACT ?? process.env.APP_URL ?? "local-development"}) - food-search`,
      },
    },
    openFoodFactsSearchPolicy(),
  );
  if (!response.ok) throw new Error(`Open Food Facts search failed with status ${response.status}.`);
  return normalizeOpenFoodFactsSearch(await response.json());
}

export async function searchOpenFoodFacts(query: string) {
  const search = new URL("https://search.openfoodfacts.org/search");
  search.search = new URLSearchParams({
    q: query,
    page_size: "6",
    langs: "pt,en",
  }).toString();
  return fetchOpenFoodFactsProducts(search);
}
