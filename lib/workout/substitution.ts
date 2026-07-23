export type ExerciseContext = { id: string; muscleGroup: string; equipment: string | null };

const equipmentTerms = ['peso corporal', 'halteres', 'barra', 'máquinas', 'cabos', 'cabo', 'faixas elásticas'] as const;

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function tokens(value: string | null) {
  const normalized = normalize(value ?? '');
  return new Set(equipmentTerms.filter((term) => normalized.includes(normalize(term))).map((term) => term === 'cabo' ? 'cabos' : term));
}

export function isEquipmentAvailable(equipment: string | null, availableEquipment: string[]) {
  if (!availableEquipment.length) return true;
  const candidateTokens = tokens(equipment);
  if (!candidateTokens.size || candidateTokens.has('peso corporal')) return true;
  const allowed = new Set(availableEquipment.flatMap((item) => [...tokens(item)]));
  return [...candidateTokens].some((token) => allowed.has(token));
}

export function isCompatibleAlternative(current: ExerciseContext, candidate: ExerciseContext, availableEquipment: string[]) {
  if (candidate.id === current.id || candidate.muscleGroup !== current.muscleGroup) return false;
  const candidateTokens = tokens(candidate.equipment);
  if (!candidateTokens.size || candidateTokens.has('peso corporal')) return true;
  if (availableEquipment.length) return isEquipmentAvailable(candidate.equipment, availableEquipment);
  const allowed = tokens(current.equipment);
  return [...candidateTokens].some((token) => allowed.has(token));
}
