import { describe, expect, it } from 'vitest';
import { measurementData, measurementSchema } from './measurement';

describe('body measurement validation', () => {
  it('accepts weight and optional centimeter measures', () => {
    const parsed = measurementSchema.parse({ measuredAt: '2026-07-22', weightKg: '68.4', waistCm: '81.2', hipCm: '' });
    expect(measurementData(parsed)).toMatchObject({ weightKg: 68.4, waistCm: 81.2, hipCm: null });
  });

  it('rejects impossible dates and unsafe ranges', () => {
    expect(measurementSchema.safeParse({ measuredAt: '2026-02-31', weightKg: 68 }).success).toBe(false);
    expect(measurementSchema.safeParse({ measuredAt: '2026-07-22', weightKg: 10 }).success).toBe(false);
  });
});
