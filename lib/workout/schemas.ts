import { z } from "zod";
import { WORKOUT_FOCUSES, WORKOUT_GENERATION_DIVISIONS, WORKOUT_RULE_VERSION } from './generator';

export const workoutGenerationRequestSchema = z.object({
  division: z.enum(WORKOUT_GENERATION_DIVISIONS),
  focus: z.enum(WORKOUT_FOCUSES),
});

export const workoutPlanExerciseSchema = z.object({
  exerciseId: z.string().cuid(),
  dayIndex: z.coerce.number().int().min(0).max(6),
  position: z.coerce.number().int().min(0).max(50),
  targetSets: z.coerce.number().int().min(1).max(12),
  targetReps: z.string().trim().min(1).max(40),
  restSeconds: z.coerce.number().int().min(15).max(900),
});

export const workoutPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    division: z.enum(["FULL_BODY", "A", "AB", "ABC", "ABCD", "ABCDE", "CUSTOM"]),
    generationRuleVersion: z.literal(WORKOUT_RULE_VERSION).nullable().optional(),
    generationDivision: z.enum(WORKOUT_GENERATION_DIVISIONS).nullable().optional(),
    generationFocus: z.enum(WORKOUT_FOCUSES).nullable().optional(),
    exercises: z.array(workoutPlanExerciseSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.generationRuleVersion && (!value.generationDivision || !value.generationFocus)) {
      context.addIssue({
        code: "custom",
        path: ["generationFocus"],
        message: "Informe a divisão e o foco usados para gerar a sugestão.",
      });
    }
    if (value.generationDivision && value.generationDivision !== value.division) {
      context.addIssue({
        code: "custom",
        path: ["generationDivision"],
        message: "A divisão confirmada precisa ser a mesma da sugestão gerada.",
      });
    }
    const positions = new Set<string>();
    value.exercises.forEach((exercise, index) => {
      const key = `${exercise.dayIndex}:${exercise.position}`;
      if (positions.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["exercises", index, "position"],
          message: "A ordem dos exercícios precisa ser única em cada dia.",
        });
      }
      positions.add(key);
    });
  });

export const exerciseSetSchema = z.object({
  sessionExerciseId: z.string().cuid(),
  setNumber: z.coerce.number().int().min(1).max(50),
  repetitions: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  weightKg: z.coerce.number().min(0).max(5000).nullable().optional(),
  effortRpe: z.coerce.number().min(1).max(10).nullable().optional(),
  completed: z.boolean().default(true),
});
