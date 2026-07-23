import { Buffer } from "node:buffer";
import { z } from "zod";

export const WORKOUT_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const workoutImportExerciseSchema = z.object({
  exercise: z.string().trim().min(1, "Informe o exercício.").max(160),
  sets: z.coerce.number().int().min(1).max(12).default(3),
  reps: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(40)).default("8-12"),
  restSeconds: z.coerce.number().int().min(15).max(900).default(75),
}).strict();

export const workoutImportSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano.").max(120),
  division: z.enum(["FULL_BODY", "A", "AB", "ABC", "ABCD", "ABCDE", "CUSTOM"]).optional(),
  days: z.array(z.object({
    label: z.string().trim().min(1).max(80).optional(),
    exercises: z.array(workoutImportExerciseSchema).min(1).max(40),
  }).strict()).min(1).max(7),
}).strict();

export type ParsedWorkoutImport = z.infer<typeof workoutImportSchema>;

export function normalizedExerciseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function validateWorkoutJsonUpload(input: { filename: string; mimeType: string; content: string }) {
  if (!input.filename.trim().toLowerCase().endsWith(".json")) throw new Error("Use um arquivo com extensão .json.");
  if (!['application/json', 'text/json'].includes(input.mimeType.toLowerCase())) throw new Error("O tipo do arquivo deve ser application/json.");
  const byteSize = Buffer.byteLength(input.content, "utf8");
  if (byteSize === 0) throw new Error("O arquivo está vazio.");
  if (byteSize > WORKOUT_IMPORT_MAX_BYTES) throw new Error("O arquivo JSON deve ter no máximo 2 MB.");
  if (input.content.trimStart()[0] !== "{") throw new Error("O arquivo deve conter um objeto JSON.");
  let decoded: unknown;
  try { decoded = JSON.parse(input.content); } catch { throw new Error("O conteúdo não é um JSON válido."); }
  const parsed = workoutImportSchema.safeParse(decoded);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "A estrutura do treino é inválida.");
  return { data: parsed.data, byteSize };
}

export function inferredWorkoutDivision(days: number) {
  if (days === 1) return "FULL_BODY";
  const commonDivisions: Record<number, string> = { 2: "AB", 3: "ABC", 4: "ABCD", 5: "ABCDE" };
  if (commonDivisions[days]) return commonDivisions[days];
  return "CUSTOM";
}

export function buildWorkoutImportProposal(
  data: ParsedWorkoutImport,
  catalog: Array<{ id: string; name: string }>,
) {
  const byName = new Map(catalog.map((exercise) => [normalizedExerciseName(exercise.name), exercise]));
  const unresolved = new Set<string>();
  const exercises = data.days.flatMap((day, dayIndex) => day.exercises.flatMap((item, position) => {
    const match = byName.get(normalizedExerciseName(item.exercise));
    if (!match) {
      unresolved.add(item.exercise);
      return [];
    }
    return [{
      exerciseId: match.id,
      name: match.name,
      dayIndex,
      position,
      targetSets: item.sets,
      targetReps: item.reps,
      restSeconds: item.restSeconds,
    }];
  }));
  return {
    proposal: {
      name: data.name,
      division: data.division ?? inferredWorkoutDivision(data.days.length),
      dayLabels: data.days.map((day, index) => day.label ?? `Dia ${index + 1}`),
      exercises,
    },
    unresolved: [...unresolved],
  };
}
