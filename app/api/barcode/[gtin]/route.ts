import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from '@/lib/observability/logger';
import { getCurrentSession } from "@/lib/auth/session";
import { gtinLookupVariants, isSupportedGtin } from "@/lib/catalog/gtin";
import {
  BRAZILIAN_REFERENCE_SOURCE,
  BRAZILIAN_REFERENCE_WARNING,
  findBrazilianFoodReference,
} from "@/lib/catalog/brazilian-foods";
import { normalizeOpenFoodFactsProduct } from "@/lib/catalog/open-food-facts";
import { db } from "@/lib/db";
import { openFoodFactsPolicy } from "@/lib/integrations/provider-policy";
import { ProviderGateError, resilientProviderFetch } from "@/lib/integrations/resilient-fetch";
import { recordOperationalMetricSafely } from '@/lib/observability/metrics';

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ gtin: string }> };

function warningForSource(source: string) {
  if (source === BRAZILIAN_REFERENCE_SOURCE) return BRAZILIAN_REFERENCE_WARNING;
  return undefined;
}

function cachedFoodScore(
  food: { ownerId: string | null; sourceExpiresAt: Date | null; sourceFetchedAt: Date | null },
  now: Date,
) {
  const isFresh = !food.sourceExpiresAt || food.sourceExpiresAt > now;
  return (food.ownerId ? 1_000_000_000_000_000 : 0) +
    (isFresh ? 100_000_000_000_000 : 0) +
    (food.sourceFetchedAt?.getTime() ?? 0);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  const observe = (outcome: string, dimension = 'open_food_facts') => recordOperationalMetricSafely({ metric: 'scanner.barcode_lookup', outcome, durationMs: Date.now() - startedAt, dimension });
  const session = await getCurrentSession();
  if (!session) { await observe('unauthorized'); return NextResponse.json({ error: "Sessão expirada." }, { status: 401 }); }
  const { gtin } = await context.params;
  if (!isSupportedGtin(gtin)) {
    await observe('invalid_gtin', 'validation');
    return NextResponse.json({ error: "Código de barras inválido." }, { status: 400 });
  }
  const lookupGtins = gtinLookupVariants(gtin);

  const now = new Date();
  const cachedCandidates = await db.food.findMany({
    where: { barcode: { in: lookupGtins }, source: { not: "FATSECRET" }, calories: { gte: 0, lte: 1_000 }, OR: [{ ownerId: session.userId }, { ownerId: null }] },
    include: { portions: true },
  });
  const cached = cachedCandidates.sort(
    (left, right) => cachedFoodScore(right, now) - cachedFoodScore(left, now),
  )[0] ?? null;
  const cacheIsFresh = cached && (!cached.sourceExpiresAt || cached.sourceExpiresAt > now);
  if (cacheIsFresh) {
    logEvent('info', 'catalog.barcode.cache_hit', { correlationId, source: cached.source, durationMs: Date.now() - startedAt });
    await observe('cache_hit', cached.source);
    return NextResponse.json({
      food: cached,
      cached: true,
      stale: false,
      fetchedAt: cached.sourceFetchedAt,
      warning: warningForSource(cached.source),
    });
  }

  try {
    const fields = [
      "code",
      "product_name",
      "brands",
      "product_quantity",
      "product_quantity_unit",
      "serving_quantity",
      "nutrition",
      "nutriments",
    ].join(",");
    let normalized: ReturnType<typeof normalizeOpenFoodFactsProduct> = null;
    let matchedGtin = gtin;
    let upstreamStatus = 404;
    let productWasIncomplete = false;
    let providerFailure: unknown;

    for (const lookupGtin of lookupGtins) {
      try {
        const response = await resilientProviderFetch(
          'OPEN_FOOD_FACTS',
          `https://world.openfoodfacts.org/api/v3.6/product/${lookupGtin}?fields=${fields}`,
          {
            headers: {
              "User-Agent": `EasyFit/0.1 (${process.env.APP_URL ?? "local-development"}) - barcode-scan`,
            },
          },
          openFoodFactsPolicy(),
        );
        upstreamStatus = response.status;
        if (!response.ok) {
          if (response.status === 404) continue;
          break;
        }
        normalized = normalizeOpenFoodFactsProduct(await response.json());
        if (normalized) {
          matchedGtin = lookupGtin;
          break;
        }
        productWasIncomplete = true;
      } catch (error) {
        providerFailure = error;
        break;
      }
    }

    const brazilianReference = lookupGtins
      .map((lookupGtin) => findBrazilianFoodReference(lookupGtin))
      .find((reference) => reference !== null) ?? null;

    if (!normalized && brazilianReference) {
      const referenceData = {
        name: brazilianReference.name,
        brand: brazilianReference.brand,
        baseQuantity: brazilianReference.baseQuantity,
        baseUnit: brazilianReference.baseUnit,
        calories: brazilianReference.calories,
        proteinGrams: brazilianReference.proteinGrams,
        carbohydrateGrams: brazilianReference.carbohydrateGrams,
        fatGrams: brazilianReference.fatGrams,
        fiberGrams: brazilianReference.fiberGrams,
        sourceReference: brazilianReference.sourceReference,
      };
      const food = await db.food.upsert({
        where: { barcode_source: { barcode: gtin, source: BRAZILIAN_REFERENCE_SOURCE } },
        create: {
          ...referenceData,
          barcode: gtin,
          source: BRAZILIAN_REFERENCE_SOURCE,
          sourceFetchedAt: now,
        },
        update: {
          ...referenceData,
          sourceFetchedAt: now,
        },
        include: { portions: true },
      });
      logEvent('info', 'catalog.barcode.brazilian_reference', { correlationId, source: food.source, durationMs: Date.now() - startedAt });
      await observe('brazilian_reference', food.source);
      return NextResponse.json({
        food,
        cached: false,
        stale: false,
        fetchedAt: food.sourceFetchedAt,
        warning: BRAZILIAN_REFERENCE_WARNING,
      });
    }

    if (!normalized && providerFailure) throw providerFailure;

    if (!normalized && !productWasIncomplete) {
      if (cached) {
        logEvent('warn', 'catalog.barcode.stale_fallback', { correlationId, source: cached.source, upstreamStatus, durationMs: Date.now() - startedAt });
        await observe('stale_fallback', cached.source);
        return NextResponse.json({ food: cached, cached: true, stale: true, fetchedAt: cached.sourceFetchedAt, warning: 'Fonte indisponivel; exibindo dados antigos identificados.' });
      }
      logEvent('warn', 'catalog.barcode.not_found', { correlationId, upstreamStatus, durationMs: Date.now() - startedAt });
      await observe('not_found');
      return NextResponse.json(
        { error: "Produto não encontrado.", manualRegistration: true, gtin },
        { status: 404 },
      );
    }
    if (!normalized) {
      if (cached) {
        logEvent('warn', 'catalog.barcode.invalid_refresh', { correlationId, source: cached.source, durationMs: Date.now() - startedAt });
        await observe('invalid_refresh', cached.source);
        return NextResponse.json({ food: cached, cached: true, stale: true, fetchedAt: cached.sourceFetchedAt, warning: 'Atualizacao incompleta; exibindo a versao anterior identificada.' });
      }
      await observe('incomplete_product');
      return NextResponse.json(
        { error: "O produto não possui dados nutricionais suficientes.", manualRegistration: true, gtin },
        { status: 422 },
      );
    }

    const food = await db.food.upsert({
      where: { barcode_source: { barcode: matchedGtin, source: "OPEN_FOOD_FACTS" } },
      create: {
        ...normalized,
        barcode: matchedGtin,
        source: "OPEN_FOOD_FACTS",
        sourceReference: `https://world.openfoodfacts.org/product/${matchedGtin}`,
        sourceFetchedAt: now,
        sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000),
      },
      update: {
        ...normalized,
        sourceReference: `https://world.openfoodfacts.org/product/${matchedGtin}`,
        sourceFetchedAt: now,
        sourceExpiresAt: new Date(now.getTime() + 7 * 86_400_000),
      },
      include: { portions: true },
    });
    logEvent('info', 'catalog.barcode.refreshed', { correlationId, source: food.source, durationMs: Date.now() - startedAt });
    await observe('refreshed', food.source);
    return NextResponse.json({ food, cached: false, stale: false, fetchedAt: food.sourceFetchedAt });
  } catch (error) {
    if (cached) {
      logEvent('warn', 'catalog.barcode.stale_fallback', { correlationId, source: cached.source, durationMs: Date.now() - startedAt, errorName: error instanceof Error ? error.name : 'UnknownError' });
      await observe('stale_fallback', cached.source);
      return NextResponse.json({ food: cached, cached: true, stale: true, fetchedAt: cached.sourceFetchedAt, warning: 'Fonte temporariamente indisponivel; exibindo dados antigos identificados.' });
    }
    if (error instanceof ProviderGateError) {
      logEvent('warn', 'catalog.barcode.provider_gated', { correlationId, reason: error.reason, retryAfterSeconds: error.retryAfterSeconds, durationMs: Date.now() - startedAt });
      await observe('provider_gated');
      return NextResponse.json(
        { error: "A fonte nutricional está temporariamente limitada. Tente novamente ou cadastre manualmente.", manualRegistration: true, gtin },
        { status: 503, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    logEvent('error', 'catalog.barcode.failure', { correlationId, durationMs: Date.now() - startedAt, errorName: error instanceof Error ? error.name : 'UnknownError' });
    await observe('failure');
    return NextResponse.json(
      { error: "A fonte nutricional está indisponível. Tente novamente ou cadastre manualmente.", manualRegistration: true, gtin },
      { status: 503 },
    );
  }
}
