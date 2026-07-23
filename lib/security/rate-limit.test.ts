import { describe, expect, it } from 'vitest';
import { nextRateLimitState, rateLimitDecision } from './rate-limit-policy';

describe('persistent rate limit policy', () => {
  const now = new Date('2026-07-22T20:00:00.000Z');

  it('starts and resets a fixed window', () => {
    const first = nextRateLimitState(null, now, 60_000);
    expect(first).toEqual({ attempts: 1, resetAt: new Date('2026-07-22T20:01:00.000Z') });
    expect(nextRateLimitState({ attempts: 8, resetAt: now }, now, 60_000)).toEqual(first);
  });

  it('increments attempts and returns a retry delay after the limit', () => {
    const state = nextRateLimitState({ attempts: 8, resetAt: new Date(now.getTime() + 30_000) }, now, 60_000);
    expect(state.attempts).toBe(9);
    expect(rateLimitDecision(state, now, 8)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });
});
