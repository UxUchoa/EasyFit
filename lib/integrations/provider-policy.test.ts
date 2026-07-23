import { describe, expect, it } from 'vitest';
import { providerRetryDelayMs, shouldRetryProviderStatus } from './provider-policy';

describe('external provider retry policy', () => {
  it('retries transient responses but not missing products', () => {
    expect(shouldRetryProviderStatus(408)).toBe(true);
    expect(shouldRetryProviderStatus(429)).toBe(true);
    expect(shouldRetryProviderStatus(503)).toBe(true);
    expect(shouldRetryProviderStatus(404)).toBe(false);
  });

  it('uses bounded exponential backoff', () => {
    expect(providerRetryDelayMs(1, 150)).toBe(150);
    expect(providerRetryDelayMs(3, 150)).toBe(600);
    expect(providerRetryDelayMs(20, 150)).toBe(10_000);
  });
});
