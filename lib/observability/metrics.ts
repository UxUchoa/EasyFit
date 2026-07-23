import { db } from '@/lib/db';

export const LATENCY_UPPER_BOUNDS_MS = [50, 100, 250, 500, 1_000, 2_500, 5_000, 30_000] as const;
const SAFE_LABEL = /^[a-z0-9_.-]{1,80}$/i;

export function latencyUpperBound(durationMs: number) {
  const normalized = Math.max(0, Math.round(durationMs));
  return LATENCY_UPPER_BOUNDS_MS.find((bound) => normalized <= bound) ?? 30_000;
}

export function metricBucketStart(now = new Date()) {
  const bucket = new Date(now);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

export function estimatePercentileUpperBound(rows: Array<{ latencyUpperMs: number; count: number }>, percentile = 0.95) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return null;
  const target = Math.ceil(total * percentile);
  let cumulative = 0;
  for (const row of [...rows].sort((a, b) => a.latencyUpperMs - b.latencyUpperMs)) {
    cumulative += row.count;
    if (cumulative >= target) return row.latencyUpperMs;
  }
  return rows.reduce((maximum, row) => Math.max(maximum, row.latencyUpperMs), 0);
}

export async function recordOperationalMetric(input: { metric: string; outcome: string; durationMs: number; dimension?: string; now?: Date }) {
  const metric = SAFE_LABEL.test(input.metric) ? input.metric : 'invalid_metric';
  const outcome = SAFE_LABEL.test(input.outcome) ? input.outcome.slice(0, 32) : 'invalid';
  const dimension = input.dimension && SAFE_LABEL.test(input.dimension) ? input.dimension : 'all';
  const durationMs = Math.min(30_000, Math.max(0, Math.round(input.durationMs)));
  const key = { metric, outcome, dimension, bucketStart: metricBucketStart(input.now), latencyUpperMs: latencyUpperBound(durationMs) };
  const row = await db.operationalMetric.upsert({
    where: { metric_outcome_dimension_bucketStart_latencyUpperMs: key },
    create: { ...key, count: 1, totalDurationMs: durationMs, maxDurationMs: durationMs },
    update: { count: { increment: 1 }, totalDurationMs: { increment: durationMs } },
  });
  if (durationMs > row.maxDurationMs) await db.operationalMetric.updateMany({ where: { id: row.id, maxDurationMs: { lt: durationMs } }, data: { maxDurationMs: durationMs } });
}

export async function recordOperationalMetricSafely(input: Parameters<typeof recordOperationalMetric>[0]) {
  try { await recordOperationalMetric(input); } catch { /* observability must not break the product path */ }
}
