export type ReportEntry = {
  kind: 'PLANNED' | 'CONSUMED';
  calories: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  macrosComplete: boolean;
};

type NutritionValues = { calories: number; proteinGrams: number; carbohydrateGrams: number; fatGrams: number };

const emptyValues = (): NutritionValues => ({ calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0 });

export function summarizeReportEntries(entries: ReportEntry[]) {
  const consumed = emptyValues();
  const planned = emptyValues();
  let consumedCount = 0;
  let plannedCount = 0;
  let macrosComplete = true;
  for (const entry of entries) {
    const target = entry.kind === 'CONSUMED' ? consumed : planned;
    target.calories += entry.calories;
    target.proteinGrams += entry.proteinGrams ?? 0;
    target.carbohydrateGrams += entry.carbohydrateGrams ?? 0;
    target.fatGrams += entry.fatGrams ?? 0;
    if (entry.kind === 'CONSUMED') {
      consumedCount += 1;
      if (!entry.macrosComplete) macrosComplete = false;
    } else {
      plannedCount += 1;
    }
  }
  return { consumed, planned, consumedCount, plannedCount, macrosComplete: consumedCount === 0 || macrosComplete };
}

export function trainingSetVolume(weightKg: number | null, repetitions: number | null) {
  if (weightKg === null || repetitions === null) return null;
  return Math.round(weightKg * repetitions * 100) / 100;
}

export function summarizeTrainingAdherence(statuses: Array<'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>) {
  const planned = statuses.filter((status) => status === 'PLANNED').length;
  const inProgress = statuses.filter((status) => status === 'IN_PROGRESS').length;
  const completed = statuses.filter((status) => status === 'COMPLETED').length;
  const cancelled = statuses.filter((status) => status === 'CANCELLED').length;
  const expected = planned + inProgress + completed + cancelled;
  const started = inProgress + completed + cancelled;
  return { expected, planned, started, inProgress, completed, cancelled, adherencePercent: expected ? Math.round((completed / expected) * 100) : null };
}
