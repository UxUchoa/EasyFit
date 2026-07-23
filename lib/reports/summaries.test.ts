import { describe, expect, it } from 'vitest';
import { summarizeReportEntries, summarizeTrainingAdherence, trainingSetVolume } from './summaries';

describe('report summaries', () => {
  it('separates planned and consumed nutrition without inventing missing macros', () => {
    const result = summarizeReportEntries([
      { kind: 'CONSUMED', calories: 200, proteinGrams: null, carbohydrateGrams: null, fatGrams: null, macrosComplete: false },
      { kind: 'CONSUMED', calories: 120, proteinGrams: 10, carbohydrateGrams: 15, fatGrams: 2, macrosComplete: true },
      { kind: 'PLANNED', calories: 400, proteinGrams: 25, carbohydrateGrams: 40, fatGrams: 10, macrosComplete: true },
    ]);
    expect(result.consumed).toEqual({ calories: 320, proteinGrams: 10, carbohydrateGrams: 15, fatGrams: 2 });
    expect(result.planned.calories).toBe(400);
    expect(result.macrosComplete).toBe(false);
  });

  it('calculates per-set volume only when load and repetitions exist', () => {
    expect(trainingSetVolume(42.5, 8)).toBe(340);
    expect(trainingSetVolume(null, 8)).toBeNull();
  });

  it('documents workout adherence across planned, started and completed states', () => {
    expect(summarizeTrainingAdherence(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])).toEqual({ expected: 4, planned: 1, started: 3, inProgress: 1, completed: 1, cancelled: 1, adherencePercent: 25 });
    expect(summarizeTrainingAdherence([]).adherencePercent).toBeNull();
  });
});
