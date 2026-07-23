export type ProviderPolicy = {
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  circuitFailureThreshold: number;
  circuitResetMs: number;
  quotaPerMinute: number;
};

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function openFoodFactsPolicy(): ProviderPolicy {
  return {
    timeoutMs: positiveInteger(process.env.OPEN_FOOD_FACTS_TIMEOUT_MS, 5_000, 30_000),
    maxAttempts: positiveInteger(process.env.OPEN_FOOD_FACTS_MAX_ATTEMPTS, 3, 5),
    baseDelayMs: positiveInteger(process.env.OPEN_FOOD_FACTS_RETRY_BASE_MS, 150, 5_000),
    circuitFailureThreshold: positiveInteger(process.env.OPEN_FOOD_FACTS_CIRCUIT_FAILURES, 4, 20),
    circuitResetMs: positiveInteger(process.env.OPEN_FOOD_FACTS_CIRCUIT_RESET_MS, 60_000, 3_600_000),
    quotaPerMinute: positiveInteger(process.env.OPEN_FOOD_FACTS_QUOTA_PER_MINUTE, 60, 10_000),
  };
}

export function openFoodFactsSearchPolicy(): ProviderPolicy {
  return {
    timeoutMs: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_TIMEOUT_MS, 7_000, 30_000),
    maxAttempts: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_MAX_ATTEMPTS, 2, 3),
    baseDelayMs: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_RETRY_BASE_MS, 200, 5_000),
    circuitFailureThreshold: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_CIRCUIT_FAILURES, 4, 20),
    circuitResetMs: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_CIRCUIT_RESET_MS, 60_000, 3_600_000),
    quotaPerMinute: positiveInteger(process.env.OPEN_FOOD_FACTS_SEARCH_QUOTA_PER_MINUTE, 10, 10),
  };
}

export function shouldRetryProviderStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

export function providerRetryDelayMs(attempt: number, baseDelayMs: number) {
  return Math.min(baseDelayMs * 2 ** Math.max(0, attempt - 1), 10_000);
}
