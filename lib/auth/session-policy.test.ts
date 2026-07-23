import { afterEach, describe, expect, it } from 'vitest';
import { sessionRotationIsDue, sessionRotationMs, sessionTtlMs } from './session-policy';

const ttl = process.env.SESSION_TTL_DAYS;
const rotation = process.env.SESSION_ROTATION_HOURS;
afterEach(() => { if (ttl === undefined) delete process.env.SESSION_TTL_DAYS; else process.env.SESSION_TTL_DAYS = ttl; if (rotation === undefined) delete process.env.SESSION_ROTATION_HOURS; else process.env.SESSION_ROTATION_HOURS = rotation; });

describe('session lifetime policy', () => {
  it('uses bounded configurable values and safe defaults', () => {
    process.env.SESSION_TTL_DAYS = '7'; process.env.SESSION_ROTATION_HOURS = '6';
    expect(sessionTtlMs()).toBe(7 * 86_400_000);
    expect(sessionRotationMs()).toBe(6 * 3_600_000);
    process.env.SESSION_TTL_DAYS = '999'; process.env.SESSION_ROTATION_HOURS = '0';
    expect(sessionTtlMs()).toBe(30 * 86_400_000);
    expect(sessionRotationMs()).toBe(24 * 3_600_000);
  });

  it('rotates only after the configured interval', () => {
    process.env.SESSION_ROTATION_HOURS = '2'; const now = new Date('2026-07-22T20:00:00.000Z');
    expect(sessionRotationIsDue(new Date('2026-07-22T18:00:01.000Z'), now)).toBe(false);
    expect(sessionRotationIsDue(new Date('2026-07-22T18:00:00.000Z'), now)).toBe(true);
  });
});
