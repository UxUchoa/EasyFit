import { isEquipmentAvailable } from './substitution';

export const WORKOUT_RULE_VERSION = 'easyfit-workout-2026-07-23.4';
export const WORKOUT_GENERATION_DIVISIONS = ['FULL_BODY', 'AB', 'ABC', 'ABCD', 'ABCDE'] as const;
export const WORKOUT_FOCUSES = ['STRENGTH', 'HYPERTROPHY'] as const;

export type WorkoutGenerationDivision = (typeof WORKOUT_GENERATION_DIVISIONS)[number];
export type WorkoutFocus = (typeof WORKOUT_FOCUSES)[number];
export type GenerationSelection = { division: WorkoutGenerationDivision; focus: WorkoutFocus };

type TrainingSector =
  | 'Peito'
  | 'Costas'
  | 'Ombros'
  | 'Bíceps'
  | 'Tríceps'
  | 'Antebraços'
  | 'Quadríceps'
  | 'Posterior de coxa'
  | 'Glúteos'
  | 'Panturrilhas';

type SplitSector = { key: TrainingSector; weight: number };
type SplitDay = { label: string; sectors: SplitSector[] };

const sector = (key: TrainingSector, weight = 1): SplitSector => ({ key, weight });

const SPLITS_BY_DIVISION: Record<WorkoutGenerationDivision, SplitDay[]> = {
  FULL_BODY: [{
    label: 'Corpo inteiro',
    sectors: [sector('Quadríceps', 2), sector('Posterior de coxa'), sector('Peito', 2), sector('Costas', 2), sector('Ombros'), sector('Panturrilhas')],
  }],
  AB: [
    { label: 'Superiores', sectors: [sector('Peito', 2), sector('Costas', 2), sector('Ombros'), sector('Bíceps'), sector('Tríceps')] },
    { label: 'Inferiores completos', sectors: [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')] },
  ],
  ABC: [
    { label: 'Peito, ombros e tríceps', sectors: [sector('Peito', 3), sector('Ombros', 2), sector('Tríceps')] },
    { label: 'Costas, bíceps e antebraços', sectors: [sector('Costas', 3), sector('Bíceps', 2), sector('Antebraços')] },
    { label: 'Pernas completas', sectors: [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')] },
  ],
  ABCD: [
    { label: 'Peito e tríceps', sectors: [sector('Peito', 2), sector('Tríceps')] },
    { label: 'Costas e bíceps', sectors: [sector('Costas', 2), sector('Bíceps')] },
    { label: 'Pernas completas', sectors: [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')] },
    { label: 'Ombros e antebraços', sectors: [sector('Ombros', 2), sector('Antebraços')] },
  ],
  ABCDE: [
    { label: 'Peito', sectors: [sector('Peito')] },
    { label: 'Costas', sectors: [sector('Costas')] },
    { label: 'Pernas completas', sectors: [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')] },
    { label: 'Ombros', sectors: [sector('Ombros')] },
    { label: 'Bíceps, tríceps e antebraços', sectors: [sector('Bíceps'), sector('Tríceps'), sector('Antebraços')] },
  ],
};

const HIGH_LOAD_NAMES = new Set(['Agachamento livre', 'Avanço alternado', 'Supino reto', 'Remada curvada', 'Stiff com halteres']);
const COMPOUND_EXERCISES = new Set([
  'Agachamento livre', 'Agachamento no smith', 'Agachamento goblet', 'Avanço alternado', 'Hack squat', 'Leg press', 'Leg press 45°', 'Stiff com halteres',
  'Supino reto', 'Supino inclinado com halteres', 'Supino máquina', 'Flexão de braços',
  'Remada curvada', 'Remada baixa', 'Remada máquina', 'Remada sentada', 'Remada unilateral', 'Puxada alta', 'Puxada frontal',
  'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Elevação pélvica', 'Hip thrust na máquina',
]);

const FOCUS_PRIORITY: Record<WorkoutFocus, string[]> = {
  STRENGTH: [
    'Agachamento livre', 'Agachamento no smith', 'Hack squat', 'Leg press 45°', 'Agachamento goblet', 'Avanço alternado', 'Cadeira extensora',
    'Stiff com halteres', 'Mesa flexora', 'Cadeira flexora',
    'Panturrilha em pé na máquina', 'Panturrilha no leg press', 'Panturrilha sentada',
    'Supino reto', 'Supino inclinado com halteres', 'Supino máquina', 'Flexão de braços', 'Peck deck', 'Crucifixo com halteres',
    'Remada curvada', 'Remada baixa', 'Puxada alta', 'Remada máquina', 'Puxada frontal', 'Remada unilateral',
    'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Elevação pélvica',
    'Rosca direta', 'Rosca Scott', 'Rosca martelo',
    'Tríceps no cabo', 'Tríceps corda', 'Tríceps francês',
    'Rosca inversa', 'Rosca de punho', 'Caminhada do fazendeiro',
  ],
  HYPERTROPHY: [
    'Leg press 45°', 'Hack squat', 'Agachamento no smith', 'Agachamento livre', 'Agachamento goblet', 'Avanço alternado', 'Cadeira extensora',
    'Stiff com halteres', 'Mesa flexora', 'Cadeira flexora',
    'Panturrilha em pé na máquina', 'Panturrilha no leg press', 'Panturrilha sentada',
    'Supino máquina', 'Supino inclinado com halteres', 'Supino reto', 'Flexão de braços', 'Peck deck', 'Crucifixo com halteres',
    'Puxada alta', 'Remada baixa', 'Remada máquina', 'Remada unilateral', 'Puxada frontal', 'Remada curvada',
    'Desenvolvimento na máquina', 'Desenvolvimento de ombros', 'Elevação lateral', 'Elevação lateral no cabo', 'Crucifixo inverso',
    'Rosca Scott', 'Rosca direta', 'Rosca martelo',
    'Tríceps corda', 'Tríceps no cabo', 'Tríceps francês',
    'Rosca inversa', 'Rosca de punho', 'Caminhada do fazendeiro',
    'Hip thrust na máquina', 'Elevação pélvica', 'Cadeira abdutora', 'Abdução de quadril',
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

function exerciseSector(exercise: GenerationExercise): TrainingSector | null {
  if (exercise.muscleGroup === 'Core') return null;
  if (exercise.muscleGroup === 'Pernas') {
    if (/stiff|flexora|terra romeno/i.test(exercise.name)) return 'Posterior de coxa';
    return 'Quadríceps';
  }
  if (exercise.muscleGroup === 'Panturrilhas') return 'Panturrilhas';
  if (exercise.muscleGroup === 'Glúteos') return 'Glúteos';
  if (['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraços'].includes(exercise.muscleGroup)) {
    return exercise.muscleGroup as TrainingSector;
  }
  return null;
}

function normalizedPrioritySectors(groups: string[]) {
  return new Set(groups.flatMap((group) => {
    if (group === 'Braços') return ['Bíceps', 'Tríceps', 'Antebraços'];
    if (group === 'Pernas') return ['Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilhas'];
    return [group];
  }));
}

function rankedPool(pool: GenerationExercise[], focus: WorkoutFocus) {
  const rank = new Map(FOCUS_PRIORITY[focus].map((name, index) => [name, index]));
  return [...pool].sort((left, right) => {
    const difference = (rank.get(left.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.name) ?? Number.MAX_SAFE_INTEGER);
    return difference || left.name.localeCompare(right.name, 'pt-BR');
  });
}

function selectDayExercises(pool: GenerationExercise[], day: SplitDay, count: number, priorities: Set<string>) {
  const candidatesBySector = new Map(day.sectors.map(({ key }) => [key, pool.filter((exercise) => exerciseSector(exercise) === key)]));
  const allocations = new Map<TrainingSector, number>(day.sectors.map(({ key }) => [key, 0]));
  let remaining = count;

  // Primeiro garante cobertura dos setores na ordem do treino.
  for (const { key } of day.sectors) {
    if (remaining === 0) break;
    if ((candidatesBySector.get(key)?.length ?? 0) === 0) continue;
    allocations.set(key, 1);
    remaining -= 1;
  }

  // Depois distribui vagas extras proporcionalmente, sem mudar a ordem dos blocos.
  while (remaining > 0) {
    let chosen: SplitSector | null = null;
    let chosenScore = -1;
    for (const candidate of day.sectors) {
      const allocated = allocations.get(candidate.key) ?? 0;
      if (allocated >= (candidatesBySector.get(candidate.key)?.length ?? 0)) continue;
      const priorityBonus = priorities.has(candidate.key) ? 0.25 : 0;
      const score = (candidate.weight + priorityBonus) / (allocated + 1);
      if (score > chosenScore) {
        chosen = candidate;
        chosenScore = score;
      }
    }
    if (!chosen) break;
    allocations.set(chosen.key, (allocations.get(chosen.key) ?? 0) + 1);
    remaining -= 1;
  }

  return day.sectors.flatMap(({ key }) => (candidatesBySector.get(key) ?? []).slice(0, allocations.get(key) ?? 0));
}

function exercisesPerDay(profile: GenerationProfile, selection: GenerationSelection, hasRestrictions: boolean) {
  if (selection.division === 'FULL_BODY') return hasRestrictions ? 5 : 7;
  if (hasRestrictions) return 4;
  if (selection.division === 'AB') {
    if (selection.focus === 'STRENGTH') return profile.trainingExperience === 'beginner' ? 5 : 6;
    return profile.trainingExperience === 'beginner' ? 6 : 7;
  }
  if (selection.division === 'ABCDE') return profile.trainingExperience === 'beginner' ? 4 : 5;
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
  warnings.push('A sessão está ordenada em blocos: exercícios multiarticulares e do setor principal vêm antes dos acessórios dos setores seguintes.');

  const equipmentPool = catalog.filter((exercise) => exerciseSector(exercise) !== null && isEquipmentAvailable(exercise.equipment, profile.availableEquipment));
  const safePool = hasRestrictions
    ? equipmentPool.filter((exercise) => !HIGH_LOAD_NAMES.has(exercise.name) && !exercise.equipment?.toLowerCase().includes('barra'))
    : equipmentPool;
  const pool = rankedPool(safePool, selection.focus);
  const split = SPLITS_BY_DIVISION[selection.division];
  const priorities = normalizedPrioritySectors(profile.priorityMuscleGroups);
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
