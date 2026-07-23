import { isEquipmentAvailable } from './substitution';

export const WORKOUT_RULE_VERSION = 'easyfit-workout-2026-07-23.5';
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
type SplitDay = { label: string; sectors: SplitSector[]; strengthCount: number; hypertrophyCount: number };

const sector = (key: TrainingSector, weight = 1): SplitSector => ({ key, weight });
const splitDay = (label: string, sectors: SplitSector[], strengthCount: number, hypertrophyCount: number): SplitDay => ({ label, sectors, strengthCount, hypertrophyCount });

const SPLITS_BY_DIVISION: Record<WorkoutGenerationDivision, SplitDay[]> = {
  FULL_BODY: [splitDay('Corpo inteiro', [sector('Quadríceps', 2), sector('Posterior de coxa'), sector('Peito', 2), sector('Costas', 2), sector('Ombros'), sector('Panturrilhas')], 7, 7)],
  AB: [
    splitDay('Superiores', [sector('Peito', 2), sector('Costas', 2), sector('Ombros'), sector('Bíceps'), sector('Tríceps')], 6, 7),
    splitDay('Inferiores completos', [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')], 6, 6),
  ],
  ABC: [
    splitDay('Peito, ombros e tríceps', [sector('Peito', 2), sector('Ombros'), sector('Tríceps', 2)], 6, 7),
    splitDay('Costas, bíceps e antebraços', [sector('Costas'), sector('Bíceps'), sector('Antebraços', 0.5)], 6, 7),
    splitDay('Pernas completas', [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')], 5, 6),
  ],
  ABCD: [
    splitDay('Peito e tríceps', [sector('Peito'), sector('Tríceps')], 6, 8),
    splitDay('Costas e bíceps', [sector('Costas'), sector('Bíceps')], 6, 8),
    splitDay('Pernas completas', [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')], 5, 6),
    splitDay('Ombros e antebraços', [sector('Ombros', 2), sector('Antebraços')], 5, 6),
  ],
  ABCDE: [
    splitDay('Peito', [sector('Peito')], 4, 4),
    splitDay('Costas', [sector('Costas')], 4, 4),
    splitDay('Pernas completas', [sector('Quadríceps', 2), sector('Posterior de coxa', 2), sector('Glúteos'), sector('Panturrilhas')], 5, 6),
    splitDay('Ombros', [sector('Ombros')], 4, 4),
    splitDay('Bíceps, tríceps e antebraços', [sector('Bíceps'), sector('Tríceps'), sector('Antebraços', 0.5)], 6, 7),
  ],
};

const HIGH_LOAD_NAMES = new Set(['Agachamento livre', 'Avanço alternado', 'Supino reto', 'Remada curvada', 'Stiff com halteres']);
const COMPOUND_EXERCISES = new Set([
  'Agachamento livre', 'Agachamento no smith', 'Agachamento goblet', 'Agachamento búlgaro', 'Avanço alternado', 'Passada no smith', 'Hack squat', 'Leg press', 'Leg press 45°', 'Leg press horizontal', 'Stiff com halteres', 'Levantamento terra romeno',
  'Supino reto', 'Supino inclinado com halteres', 'Supino inclinado na máquina', 'Supino declinado com barra', 'Supino máquina', 'Chest press convergente', 'Supino fechado', 'Flexão de braços',
  'Barra fixa assistida', 'Remada curvada', 'Remada baixa', 'Remada baixa com triângulo', 'Remada máquina', 'Remada articulada', 'Remada sentada', 'Remada unilateral', 'Remada unilateral na máquina', 'Remada cavalinho', 'Puxada alta', 'Puxada frontal', 'Puxada aberta na frente', 'Puxada neutra', 'Puxada supinada',
  'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Desenvolvimento Arnold', 'Elevação pélvica', 'Hip thrust na máquina',
]);

const FOCUS_PRIORITY: Record<WorkoutFocus, string[]> = {
  STRENGTH: [
    'Agachamento livre', 'Agachamento no smith', 'Hack squat', 'Leg press 45°', 'Agachamento goblet', 'Avanço alternado', 'Cadeira extensora',
    'Stiff com halteres', 'Mesa flexora', 'Cadeira flexora',
    'Panturrilha em pé na máquina', 'Panturrilha no leg press', 'Panturrilha sentada',
    'Supino reto', 'Supino inclinado com halteres', 'Supino máquina', 'Supino inclinado na máquina', 'Chest press convergente', 'Supino declinado com barra', 'Flexão de braços', 'Crucifixo máquina', 'Peck deck', 'Crucifixo com halteres',
    'Remada curvada', 'Puxada alta', 'Remada baixa', 'Barra fixa assistida', 'Remada máquina', 'Puxada neutra', 'Remada articulada', 'Puxada frontal', 'Remada unilateral',
    'Desenvolvimento de ombros', 'Desenvolvimento na máquina', 'Desenvolvimento Arnold', 'Elevação pélvica',
    'Rosca direta', 'Rosca Scott', 'Rosca máquina', 'Rosca martelo', 'Rosca inclinada com halteres', 'Rosca no cabo',
    'Tríceps máquina', 'Tríceps pulley com barra', 'Tríceps corda', 'Tríceps acima da cabeça no cabo', 'Tríceps francês', 'Tríceps no cabo',
    'Rosca inversa', 'Rosca de punho', 'Caminhada do fazendeiro',
  ],
  HYPERTROPHY: [
    'Leg press 45°', 'Hack squat', 'Agachamento no smith', 'Agachamento livre', 'Agachamento goblet', 'Avanço alternado', 'Cadeira extensora',
    'Stiff com halteres', 'Mesa flexora', 'Cadeira flexora',
    'Panturrilha em pé na máquina', 'Panturrilha no leg press', 'Panturrilha sentada',
    'Supino reto', 'Supino inclinado com halteres', 'Supino máquina', 'Crucifixo máquina', 'Supino inclinado na máquina', 'Chest press convergente', 'Crossover no cabo', 'Peck deck', 'Crucifixo com halteres', 'Crucifixo no cabo', 'Flexão de braços',
    'Puxada alta', 'Remada baixa', 'Puxada neutra', 'Remada articulada', 'Remada máquina', 'Puxada aberta na frente', 'Remada unilateral na máquina', 'Barra fixa assistida', 'Remada unilateral', 'Puxada frontal', 'Remada curvada', 'Pulldown com braços estendidos',
    'Desenvolvimento na máquina', 'Desenvolvimento de ombros', 'Elevação lateral', 'Elevação lateral na máquina', 'Elevação lateral no cabo', 'Crucifixo inverso na máquina', 'Face pull', 'Crucifixo inverso',
    'Rosca direta', 'Rosca Scott', 'Rosca máquina', 'Rosca martelo', 'Rosca inclinada com halteres', 'Rosca no cabo', 'Rosca concentrada', 'Rosca martelo no cabo', 'Rosca spider',
    'Tríceps máquina', 'Tríceps corda', 'Tríceps acima da cabeça no cabo', 'Tríceps francês', 'Tríceps pulley com barra', 'Tríceps no cabo', 'Tríceps testa no cabo', 'Tríceps unilateral no cabo', 'Mergulho na máquina',
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
function prescription(profile: GenerationProfile, focus: WorkoutFocus, exercise: GenerationExercise, priorities: Set<string>) {
  const compound = COMPOUND_EXERCISES.has(exercise.name);
  if (focus === 'STRENGTH') {
    return {
      targetSets: profile.trainingExperience === 'beginner' ? 2 : 3,
      targetReps: compound ? '4–6' : '6–8',
      restSeconds: compound ? 150 : 90,
    };
  }
  const baseSets = compound && profile.trainingExperience !== 'beginner' ? 4 : 3;
  const prioritySets = profile.trainingExperience !== 'beginner' && priorities.has(exerciseSector(exercise) ?? '') ? 1 : 0;
  return {
    targetSets: Math.min(4, baseSets + prioritySets),
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

function exercisesPerDay(day: SplitDay, selection: GenerationSelection, hasRestrictions: boolean) {
  const selectedCount = selection.focus === 'STRENGTH' ? day.strengthCount : day.hypertrophyCount;
  if (!hasRestrictions) return selectedCount;
  return Math.min(selectedCount, Math.max(4, day.sectors.length));
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
  const exercises: Array<GenerationExercise & { dayIndex: number; position: number; targetSets: number; targetReps: string; restSeconds: number }> = [];

  split.forEach((day, dayIndex) => {
    const count = exercisesPerDay(day, selection, hasRestrictions);
    const selected = selectDayExercises(pool, day, count, priorities);
    selected.forEach((exercise, position) => exercises.push({ ...exercise, dayIndex, position, ...prescription(profile, selection.focus, exercise, priorities) }));
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
