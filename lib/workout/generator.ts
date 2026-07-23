import { isEquipmentAvailable } from './substitution';

export const WORKOUT_RULE_VERSION = 'easyfit-workout-2026-07-23.3';
export const WORKOUT_GENERATION_DIVISIONS = ['FULL_BODY', 'AB', 'ABC', 'ABCD', 'ABCDE'] as const;
export const WORKOUT_FOCUSES = ['STRENGTH', 'HYPERTROPHY'] as const;

export type WorkoutGenerationDivision = (typeof WORKOUT_GENERATION_DIVISIONS)[number];
export type WorkoutFocus = (typeof WORKOUT_FOCUSES)[number];
export type GenerationSelection = { division: WorkoutGenerationDivision; focus: WorkoutFocus };

type SplitDay = { label: string; muscleGroups: string[] };

const SPLITS_BY_DIVISION: Record<WorkoutGenerationDivision, SplitDay[]> = {
  FULL_BODY: [{ label: 'Corpo inteiro', muscleGroups: ['Pernas', 'Peito', 'Costas', 'Ombros', 'Glúteos', 'Core'] }],
  AB: [
    { label: 'Superiores', muscleGroups: ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'] },
    { label: 'Inferiores e core', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
  ],
  ABC: [
    { label: 'Peito, ombros e tríceps', muscleGroups: ['Peito', 'Ombros', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps', 'Antebraços'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
  ],
  ABCD: [
    { label: 'Peito e tríceps', muscleGroups: ['Peito', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos', 'Core'] },
    { label: 'Ombros, antebraços e core', muscleGroups: ['Ombros', 'Antebraços', 'Core'] },
  ],
  ABCDE: [
    { label: 'Peito e tríceps', muscleGroups: ['Peito', 'Tríceps'] },
    { label: 'Costas e bíceps', muscleGroups: ['Costas', 'Bíceps'] },
    { label: 'Pernas completas', muscleGroups: ['Pernas', 'Glúteos'] },
    { label: 'Ombros e antebraços', muscleGroups: ['Ombros', 'Antebraços'] },
    { label: 'Braços e core', muscleGroups: ['Bíceps', 'Tríceps', 'Core'] },
  ],
};

const HIGH_LOAD_NAMES = new Set(['Agachamento livre', 'Avanço alternado', 'Supino reto', 'Remada curvada', 'Stiff com halteres']);
const COMPOUND_EXERCISES = new Set([
  'Agachamento livre', 'Agachamento no smith', 'Hack squat', 'Leg press 45°', 'Stiff com halteres',
  'Supino reto', 'Supino inclinado com halteres', 'Supino máquina',
  'Remada curvada', 'Remada baixa', 'Remada máquina', 'Puxada alta', 'Puxada frontal',
  'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Elevação pélvica', 'Hip thrust na máquina',
]);

const FOCUS_PRIORITY: Record<WorkoutFocus, string[]> = {
  STRENGTH: [
    'Agachamento livre', 'Agachamento no smith', 'Leg press 45°', 'Stiff com halteres',
    'Supino reto', 'Supino inclinado com halteres', 'Supino máquina',
    'Remada curvada', 'Remada baixa', 'Puxada alta',
    'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Elevação pélvica',
    'Rosca direta', 'Tríceps no cabo', 'Prancha',
  ],
  HYPERTROPHY: [
    'Leg press 45°', 'Cadeira extensora', 'Mesa flexora', 'Cadeira flexora', 'Hack squat', 'Stiff com halteres',
    'Supino máquina', 'Supino inclinado com halteres', 'Supino reto', 'Peck deck',
    'Puxada alta', 'Remada baixa', 'Remada máquina', 'Remada unilateral',
    'Desenvolvimento na máquina', 'Elevação lateral', 'Elevação lateral no cabo',
    'Rosca Scott', 'Rosca direta', 'Rosca martelo',
    'Tríceps corda', 'Tríceps no cabo', 'Tríceps francês',
    'Hip thrust na máquina', 'Cadeira abdutora', 'Elevação pélvica', 'Abdominal na máquina',
  ],
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

export function generationInputSnapshot(profile: GenerationProfile, selection: GenerationSelection) {
  return {
    objective: profile.objective,
    trainingExperience: profile.trainingExperience,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    hasPhysicalRestrictions: Boolean(profile.physicalRestrictions?.trim()),
    availableEquipment: profile.availableEquipment,
    priorityMuscleGroups: profile.priorityMuscleGroups,
    selectedDivision: selection.division,
    focus: selection.focus,
  };
}

// Faixas conservadoras baseadas no ACSM 2026 e em revisões de carga/volume:
// força prioriza cargas altas e menos repetições; hipertrofia prioriza múltiplas
// séries e volume, sem exigir falha muscular ou estimar uma carga para o usuário.
function prescription(profile: GenerationProfile, focus: WorkoutFocus, exercise: GenerationExercise) {
  const compound = COMPOUND_EXERCISES.has(exercise.name);
  if (focus === 'STRENGTH') {
    return {
      targetSets: profile.trainingExperience === 'beginner' ? 2 : 3,
      targetReps: compound ? '4–6' : '6–8',
      restSeconds: compound ? 150 : 90,
    };
  }
  return {
    targetSets: compound && profile.trainingExperience !== 'beginner' ? 4 : 3,
    targetReps: compound ? '6–10' : '10–15',
    restSeconds: compound ? 120 : 75,
  };
}

function normalizedPriorityGroups(groups: string[]) {
  return new Set(groups.flatMap((group) => group === 'Braços' ? ['Bíceps', 'Tríceps', 'Antebraços'] : [group]));
}

function rankedPool(pool: GenerationExercise[], focus: WorkoutFocus) {
  const rank = new Map(FOCUS_PRIORITY[focus].map((name, index) => [name, index]));
  return [...pool].sort((left, right) => {
    const difference = (rank.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.name) ?? Number.MAX_SAFE_INTEGER);
    return difference || left.name.localeCompare(right.name, 'pt-BR');
  });
}

function selectDayExercises(pool: GenerationExercise[], day: SplitDay, count: number, priorities: Set<string>) {
  const groups = [...day.muscleGroups].sort((left, right) => Number(priorities.has(right)) - Number(priorities.has(left)));
  const candidatesByGroup = new Map(groups.map((group) => [group, pool.filter((exercise) => exercise.muscleGroup === group)]));
  const selected: GenerationExercise[] = [];
  const used = new Set<string>();

  while (selected.length < count) {
    let addedInPass = false;
    for (const group of groups) {
      const exercise = (candidatesByGroup.get(group) ?? []).find((candidate) => !used.has(candidate.id));
      if (!exercise) continue;
      selected.push(exercise);
      used.add(exercise.id);
      addedInPass = true;
      if (selected.length === count) break;
    }
    if (!addedInPass) break;
  }
  return selected;
}

function exercisesPerDay(profile: GenerationProfile, selection: GenerationSelection, hasRestrictions: boolean) {
  if (selection.division === 'FULL_BODY') return 6;
  if (hasRestrictions) return 4;
  if (selection.focus === 'STRENGTH') return profile.trainingExperience === 'beginner' ? 4 : 5;
  return profile.trainingExperience === 'beginner' ? 5 : 6;
}

export function generateWorkoutProposal(profile: GenerationProfile, catalog: GenerationExercise[], selection: GenerationSelection) {
  const hasRestrictions = Boolean(profile.physicalRestrictions?.trim());
  const warnings: string[] = ['Revise todos os exercícios antes de ativar. Esta sugestão não é prescrição nem liberação médica.'];
  if (!profile.availableEquipment.length) warnings.push('Nenhum equipamento foi informado; revise a disponibilidade antes de salvar.');
  if (hasRestrictions) warnings.push('Há restrições físicas informadas: movimentos de maior carga foram excluídos, mas a descrição não foi interpretada como diagnóstico.');
  if (profile.trainingDaysPerWeek !== SPLITS_BY_DIVISION[selection.division].length) {
    warnings.push(`Seu perfil informa ${profile.trainingDaysPerWeek} dia(s) por semana; a divisão ${selection.division === 'FULL_BODY' ? 'Full body' : selection.division} possui ${SPLITS_BY_DIVISION[selection.division].length} sessão(ões) diferente(s). Revise como irá distribuí-las na semana.`);
  }
  warnings.push(selection.focus === 'STRENGTH'
    ? 'Foco em força: priorizamos exercícios multiarticulares, 4–8 repetições e descansos mais longos. Escolha uma carga controlável; o EasyFit não estima seu 1RM.'
    : 'Foco em hipertrofia: priorizamos múltiplas séries, 6–15 repetições e volume por grupo muscular. Não é necessário chegar à falha para o plano funcionar.');
  warnings.push('A seleção prioriza nomes e equipamentos comuns em academias, respeitando o que você marcou como disponível no perfil.');

  const equipmentPool = catalog.filter((exercise) => isEquipmentAvailable(exercise.equipment, profile.availableEquipment));
  const safePool = hasRestrictions
    ? equipmentPool.filter((exercise) => !HIGH_LOAD_NAMES.has(exercise.name) && !exercise.equipment?.toLowerCase().includes('barra'))
    : equipmentPool;
  const pool = rankedPool(safePool, selection.focus);
  const split = SPLITS_BY_DIVISION[selection.division];
  const priorities = normalizedPriorityGroups(profile.priorityMuscleGroups);
  const count = exercisesPerDay(profile, selection, hasRestrictions);
  const exercises: Array<GenerationExercise & { dayIndex: number; position: number; targetSets: number; targetReps: string; restSeconds: number }> = [];

  split.forEach((day, dayIndex) => {
    const selected = selectDayExercises(pool, day, count, priorities);
    selected.forEach((exercise, position) => exercises.push({ ...exercise, dayIndex, position, ...prescription(profile, selection.focus, exercise) }));
    if (selected.length < count) warnings.push(`O catálogo compatível não preencheu o dia ${dayIndex + 1} (${day.label}); revise os equipamentos ou adicione exercícios desse setor.`);
  });

  const divisionLabel = selection.division === 'FULL_BODY' ? 'Full body' : selection.division;
  const focusLabel = selection.focus === 'STRENGTH' ? 'Força' : 'Hipertrofia';
  return {
    ruleVersion: WORKOUT_RULE_VERSION,
    name: `Plano sugerido · ${divisionLabel} · ${focusLabel}`,
    division: selection.division,
    focus: selection.focus,
    dayLabels: split.map((day) => day.label),
    warnings,
    inputs: generationInputSnapshot(profile, selection),
    exercises,
  };
}
