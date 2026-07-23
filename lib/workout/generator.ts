import { isEquipmentAvailable } from './substitution';

export const WORKOUT_RULE_VERSION = 'easyfit-workout-2026-07-23.2';
const HIGH_LOAD_NAMES = new Set(['Agachamento livre', 'Avanço alternado', 'Supino reto']);

type SplitDay = { label: string; muscleGroups: string[] };

const SPLITS_BY_DAYS: Record<number, SplitDay[]> = {
  1: [{ label: 'Full body', muscleGroups: ['Pernas', 'Peito', 'Costas', 'Ombros', 'Core', 'Bíceps', 'Tríceps'] }],
  2: [
    { label: 'Superior', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'] },
    { label: 'Inferior', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
  ],
  3: [
    { label: 'Peito, ombros e tríceps', muscleGroups: ['Peito', 'Ombros', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps', 'Antebraços'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
  ],
  4: [
    { label: 'Peito e tríceps', muscleGroups: ['Peito', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
    { label: 'Ombros e antebraços', muscleGroups: ['Ombros', 'Antebraços'] },
  ],
  5: [
    { label: 'Peito e tríceps', muscleGroups: ['Peito', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos'] },
    { label: 'Ombros e antebraços', muscleGroups: ['Ombros', 'Antebraços'] },
    { label: 'Braços e core', muscleGroups: ['Bíceps', 'Tríceps', 'Core'] },
  ],
  6: [
    { label: 'Empurrar A', muscleGroups: ['Peito', 'Ombros', 'Tríceps'] },
    { label: 'Puxar A', muscleGroups: ['Costas', 'Bíceps', 'Antebraços'] },
    { label: 'Pernas A', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
    { label: 'Empurrar B', muscleGroups: ['Peito', 'Ombros', 'Tríceps'] },
    { label: 'Puxar B', muscleGroups: ['Costas', 'Bíceps', 'Antebraços'] },
    { label: 'Pernas B', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
  ],
  7: [
    { label: 'Peito e tríceps', muscleGroups: ['Peito', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos'] },
    { label: 'Ombros e antebraços', muscleGroups: ['Ombros', 'Antebraços'] },
    { label: 'Braços e core', muscleGroups: ['Bíceps', 'Tríceps', 'Core'] },
    { label: 'Empurrar', muscleGroups: ['Peito', 'Ombros', 'Tríceps'] },
    { label: 'Puxar', muscleGroups: ['Costas', 'Bíceps', 'Antebraços'] },
  ],
};

const DIVISION_BY_DAYS: Record<number, string> = {
  1: 'FULL_BODY', 2: 'AB', 3: 'ABC', 4: 'ABCD', 5: 'ABCDE', 6: 'CUSTOM', 7: 'CUSTOM',
};

export type GenerationProfile = {
  objective: 'lose' | 'maintain' | 'gain';
  trainingExperience: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek: number;
  physicalRestrictions: string | null;
  availableEquipment: string[];
  priorityMuscleGroups: string[];
};
export type GenerationExercise = { id: string; name: string; muscleGroup: string; equipment: string | null };

export function generationInputSnapshot(profile: GenerationProfile) {
  return {
    objective: profile.objective,
    trainingExperience: profile.trainingExperience,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    hasPhysicalRestrictions: Boolean(profile.physicalRestrictions?.trim()),
    availableEquipment: profile.availableEquipment,
    priorityMuscleGroups: profile.priorityMuscleGroups,
  };
}

function prescription(profile: GenerationProfile) {
  if (profile.objective === 'gain') return { targetSets: profile.trainingExperience === 'beginner' ? 3 : 4, targetReps: '6–10', restSeconds: 90 };
  if (profile.objective === 'lose') return { targetSets: 3, targetReps: '10–15', restSeconds: 60 };
  return { targetSets: 3, targetReps: '8–12', restSeconds: 75 };
}

function normalizedPriorityGroups(groups: string[]) {
  return new Set(groups.flatMap((group) => group === 'Braços' ? ['Bíceps', 'Tríceps', 'Antebraços'] : [group]));
}

function selectDayExercises(pool: GenerationExercise[], day: SplitDay, count: number, priorities: Set<string>, dayIndex: number) {
  const groups = [...day.muscleGroups].sort((left, right) => Number(priorities.has(right)) - Number(priorities.has(left)));
  const candidatesByGroup = new Map(groups.map((group) => [group, pool.filter((exercise) => exercise.muscleGroup === group)]));
  const selected: GenerationExercise[] = [];
  const used = new Set<string>();
  let pass = 0;

  while (selected.length < count) {
    let addedInPass = false;
    for (const [groupIndex, group] of groups.entries()) {
      const available = (candidatesByGroup.get(group) ?? []).filter((exercise) => !used.has(exercise.id));
      if (!available.length) continue;
      const exercise = available[(dayIndex + groupIndex + pass) % available.length];
      selected.push(exercise);
      used.add(exercise.id);
      addedInPass = true;
      if (selected.length === count) break;
    }
    if (!addedInPass) break;
    pass += 1;
  }
  return selected;
}

export function generateWorkoutProposal(profile: GenerationProfile, catalog: GenerationExercise[]) {
  const hasRestrictions = Boolean(profile.physicalRestrictions?.trim());
  const warnings: string[] = ['Revise todos os exercícios antes de ativar. Esta sugestão não é prescrição nem liberação médica.'];
  if (!profile.availableEquipment.length) warnings.push('Nenhum equipamento foi informado; revise a disponibilidade antes de salvar.');
  if (hasRestrictions) warnings.push('Há restrições físicas informadas: movimentos de maior carga foram excluídos, mas a descrição não foi interpretada como diagnóstico.');
  const equipmentPool = catalog.filter((exercise) => isEquipmentAvailable(exercise.equipment, profile.availableEquipment));
  const pool = hasRestrictions ? equipmentPool.filter((exercise) => !HIGH_LOAD_NAMES.has(exercise.name) && !exercise.equipment?.toLowerCase().includes('barra')) : equipmentPool;
  const exercisesPerDay = hasRestrictions ? 4 : profile.trainingExperience === 'advanced' ? 6 : profile.trainingExperience === 'intermediate' ? 5 : 4;
  const days = Math.max(1, Math.min(7, profile.trainingDaysPerWeek));
  const split = SPLITS_BY_DAYS[days];
  const priorities = normalizedPriorityGroups(profile.priorityMuscleGroups);
  const prescriptionValues = prescription(profile);
  const exercises: Array<GenerationExercise & { dayIndex: number; position: number; targetSets: number; targetReps: string; restSeconds: number }> = [];

  split.forEach((day, dayIndex) => {
    const selected = selectDayExercises(pool, day, exercisesPerDay, priorities, dayIndex);
    selected.forEach((exercise, position) => exercises.push({ ...exercise, dayIndex, position, ...prescriptionValues }));
    if (selected.length < exercisesPerDay) warnings.push(`O catálogo compatível não preencheu o dia ${dayIndex + 1} (${day.label}); revise os equipamentos ou adicione exercícios desse setor.`);
  });

  const division = DIVISION_BY_DAYS[days];
  return {
    ruleVersion: WORKOUT_RULE_VERSION,
    name: division === 'FULL_BODY' ? 'Plano sugerido · Full body' : `Plano sugerido · ${division}`,
    division,
    dayLabels: split.map((day) => day.label),
    warnings,
    inputs: generationInputSnapshot(profile),
    exercises,
  };
}
