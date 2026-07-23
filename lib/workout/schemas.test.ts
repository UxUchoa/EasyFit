import { describe, expect, it } from "vitest";
import { exerciseSetSchema, workoutPlanSchema } from "./schemas";

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
