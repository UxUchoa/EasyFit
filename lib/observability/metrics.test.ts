import { describe, expect, it } from 'vitest';
import { estimatePercentileUpperBound, latencyUpperBound, metricBucketStart } from './metrics';

describe('aggregate operational metrics', () => {
  it('uses fixed UTC hour and latency buckets', () => {
    expect(metricBucketStart(new Date('2026-07-22T21:47:12.000Z')).toISOString()).toBe('2026-07-22T21:00:00.000Z');
    expect(latencyUpperBound(51)).toBe(100);
    expect(latencyUpperBound(80_000)).toBe(30_000);
  });

  it('estimates p95 from aggregate histogram rows without raw events', () => {
    expect(estimatePercentileUpperBound([{ latencyUpperMs: 100, count: 94 }, { latencyUpperMs: 500, count: 5 }, { latencyUpperMs: 1_000, count: 1 }])).toBe(500);
    expect(estimatePercentileUpperBound([])).toBeNull();
  });
});
