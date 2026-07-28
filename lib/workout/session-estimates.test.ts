import { describe, expect, it } from "vitest";
import { estimateWorkoutCalories, estimateWorkoutDuration } from "./session-estimates";

describe("workout session estimates", () => {
  it("changes duration only with progress or the selected rest interval", () => {
    const initial = estimateWorkoutDuration([{ targetSets: 3, completedSets: 0 }], 120);
    const afterOneSet = estimateWorkoutDuration([{ targetSets: 3, completedSets: 1 }], 120);
    const shorterRest = estimateWorkoutDuration([{ targetSets: 3, completedSets: 1 }], 60);

    expect(initial).toEqual({ plannedSeconds: 360, remainingSeconds: 360 });
    expect(afterOneSet).toEqual({ plannedSeconds: 360, remainingSeconds: 320 });
    expect(shorterRest).toEqual({ plannedSeconds: 240, remainingSeconds: 200 });
    expect(estimateWorkoutDuration([{ targetSets: 3, completedSets: 1 }], 120)).toEqual(afterOneSet);
  });

  it("reaches zero remaining time only after real set progress", () => {
    expect(estimateWorkoutDuration([{ targetSets: 3, completedSets: 3 }], 120).remainingSeconds).toBe(0);
  });

  it("uses duration, physical weight, completed work and volume for calories", () => {
    const lighter = estimateWorkoutCalories({ durationMinutes: 45, weightKg: 60, completedSets: 8, performedExercises: 3, volumeKg: 3_000 });
    const heavierAndDenser = estimateWorkoutCalories({ durationMinutes: 45, weightKg: 90, completedSets: 15, performedExercises: 6, volumeKg: 10_000 });

    expect(lighter).toBeGreaterThan(0);
    expect(heavierAndDenser).toBeGreaterThan(lighter);
  });

  it("uses a conservative fallback when physical weight is unavailable", () => {
    expect(estimateWorkoutCalories({ durationMinutes: 30, weightKg: null, completedSets: 0, performedExercises: 0, volumeKg: 0 })).toBe(129);
  });
});
