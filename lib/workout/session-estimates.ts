const ACTIVE_SECONDS_PER_SET = 40;
const FALLBACK_WEIGHT_KG = 70;

export type WorkoutEstimateExercise = {
  targetSets: number;
  completedSets: number;
};

export type WorkoutCalorieInput = {
  durationMinutes: number;
  weightKg: number | null;
  completedSets: number;
  performedExercises: number;
  volumeKg: number;
};

export function estimateWorkoutDuration(exercises: WorkoutEstimateExercise[], restSeconds: number) {
  const safeRestSeconds = Math.max(0, Math.round(restSeconds));
  let plannedSeconds = 0;
  let remainingSeconds = 0;

  for (const exercise of exercises) {
    const targetSets = Math.max(0, Math.round(exercise.targetSets));
    const completedSets = Math.min(targetSets, Math.max(0, Math.round(exercise.completedSets)));
    const remainingSets = targetSets - completedSets;

    plannedSeconds += targetSets * ACTIVE_SECONDS_PER_SET + Math.max(0, targetSets - 1) * safeRestSeconds;

    // Depois da primeira série concluída, o descanso atual ainda faz parte do
    // tempo restante. O contador visual nunca entra neste cálculo; por isso
    // pausar ou resetar o timer não reduz a estimativa de forma acumulativa.
    const remainingRestPeriods = remainingSets === 0 ? 0 : Math.max(0, remainingSets - (completedSets === 0 ? 1 : 0));
    remainingSeconds += remainingSets * ACTIVE_SECONDS_PER_SET + remainingRestPeriods * safeRestSeconds;
  }

  return { plannedSeconds, remainingSeconds };
}

export function estimateWorkoutCalories(input: WorkoutCalorieInput) {
  const durationMinutes = Math.min(360, Math.max(1, input.durationMinutes));
  const weightKg = input.weightKg && input.weightKg > 0 ? input.weightKg : FALLBACK_WEIGHT_KG;
  const completedSets = Math.max(0, input.completedSets);
  const performedExercises = Math.max(0, input.performedExercises);
  const volumePerMinute = Math.max(0, input.volumeKg) / durationMinutes;

  // Fórmula MET: kcal/min = MET × 3,5 × peso(kg) ÷ 200.
  // Musculação varia aproximadamente de 3,5 a 6 MET. Dentro dessa faixa,
  // séries, exercícios realizados e volume por minuto aumentam gradualmente
  // a intensidade, sem produzir estimativas extremas quando faltam dados.
  const met = Math.min(
    6,
    3.5
      + Math.min(1, completedSets / 12)
      + Math.min(0.5, performedExercises / 12)
      + Math.min(1, volumePerMinute / 500),
  );

  return Math.max(0, Math.round((met * 3.5 * weightKg / 200) * durationMinutes));
}
