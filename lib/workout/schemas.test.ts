import { describe, expect, it } from "vitest";
import { WORKOUT_RULE_VERSION } from "./generator";
import { exerciseSetSchema, workoutGenerationRequestSchema, workoutPlanSchema } from "./schemas";

describe("workout validation", () => {
  const exercise = {
    exerciseId: "cm00000000000000000000000",
    dayIndex: 0,
    position: 0,
    targetSets: 3,
    targetReps: "8–12",
    restSeconds: 75,
  };

  it("accepts manual divisions and complete exercise targets", () => {
    expect(
      workoutPlanSchema.safeParse({ name: "Meu ABC", division: "ABC", exercises: [exercise] }).success,
    ).toBe(true);
  });

  it("accepts full body as its own division", () => {
    expect(workoutPlanSchema.safeParse({ name: "Meu Full body", division: "FULL_BODY", exercises: [exercise] }).success).toBe(true);
  });

  it("accepts every supported generated division with a strength or hypertrophy focus", () => {
    for (const division of ["FULL_BODY", "AB", "ABC", "ABCD", "ABCDE"]) {
      expect(workoutGenerationRequestSchema.safeParse({ division, focus: "STRENGTH" }).success).toBe(true);
      expect(workoutGenerationRequestSchema.safeParse({ division, focus: "HYPERTROPHY" }).success).toBe(true);
    }
    expect(workoutGenerationRequestSchema.safeParse({ division: "CUSTOM", focus: "HYPERTROPHY" }).success).toBe(false);
  });

  it("requires the selected division and focus when confirming a generated plan", () => {
    const missingSelection = workoutPlanSchema.safeParse({ name: "Sugestão", division: "ABC", generationRuleVersion: WORKOUT_RULE_VERSION, exercises: [exercise] });
    const complete = workoutPlanSchema.safeParse({ name: "Sugestão", division: "ABC", generationRuleVersion: WORKOUT_RULE_VERSION, generationDivision: "ABC", generationFocus: "HYPERTROPHY", exercises: [exercise] });
    expect(missingSelection.success).toBe(false);
    expect(complete.success).toBe(true);
  });

  it("rejects two exercises in the same day position", () => {
    const result = workoutPlanSchema.safeParse({
      name: "Plano",
      division: "AB",
      exercises: [exercise, { ...exercise, exerciseId: "cm11111111111111111111111" }],
    });
    expect(result.success).toBe(false);
  });

  it("keeps effort optional and limits RPE to the one-to-ten scale", () => {
    const base = {
      sessionExerciseId: "cm22222222222222222222222",
      setNumber: 1,
      repetitions: 10,
      weightKg: 20,
      completed: true,
    };
    expect(exerciseSetSchema.safeParse(base).success).toBe(true);
    expect(exerciseSetSchema.safeParse({ ...base, effortRpe: 11 }).success).toBe(false);
  });
});
