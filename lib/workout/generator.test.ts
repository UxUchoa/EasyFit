import { describe, expect, it } from 'vitest';
import { generateWorkoutProposal, WORKOUT_RULE_VERSION, type GenerationExercise, type GenerationProfile, type GenerationSelection } from './generator';

const catalog: GenerationExercise[] = [
  { id: '1', name: 'Agachamento livre', muscleGroup: 'Pernas', equipment: 'Barra' },
  { id: '2', name: 'Leg press 45°', muscleGroup: 'Pernas', equipment: 'Máquinas' },
  { id: '3', name: 'Supino reto', muscleGroup: 'Peito', equipment: 'Barra ou halteres' },
  { id: '4', name: 'Supino máquina', muscleGroup: 'Peito', equipment: 'Máquinas' },
  { id: '5', name: 'Remada baixa', muscleGroup: 'Costas', equipment: 'Cabos' },
  { id: '6', name: 'Desenvolvimento de ombros', muscleGroup: 'Ombros', equipment: 'Halteres' },
  { id: '7', name: 'Rosca direta', muscleGroup: 'Bíceps', equipment: 'Barra ou halteres' },
  { id: '8', name: 'Tríceps no cabo', muscleGroup: 'Tríceps', equipment: 'Cabos' },
  { id: '9', name: 'Elevação pélvica', muscleGroup: 'Glúteos', equipment: 'Barra' },
  { id: '10', name: 'Prancha', muscleGroup: 'Core', equipment: 'Peso corporal' },
  { id: '11', name: 'Rosca inversa', muscleGroup: 'Antebraços', equipment: 'Barra ou halteres' },
];

const profile: GenerationProfile = {
  objective: 'maintain',
  trainingExperience: 'intermediate',
  trainingDaysPerWeek: 3,
  physicalRestrictions: null,
  availableEquipment: [],
  priorityMuscleGroups: ['Costas'],
};

const splitCatalog: GenerationExercise[] = [
  ['Peito 1', 'Peito'], ['Peito 2', 'Peito'], ['Peito 3', 'Peito'],
  ['Tríceps 1', 'Tríceps'], ['Tríceps 2', 'Tríceps'], ['Tríceps 3', 'Tríceps'],
  ['Costas 1', 'Costas'], ['Costas 2', 'Costas'], ['Costas 3', 'Costas'],
  ['Bíceps 1', 'Bíceps'], ['Bíceps 2', 'Bíceps'], ['Bíceps 3', 'Bíceps'],
  ['Pernas 1', 'Pernas'], ['Pernas 2', 'Pernas'], ['Pernas 3', 'Pernas'],
  ['Glúteos 1', 'Glúteos'], ['Glúteos 2', 'Glúteos'], ['Glúteos 3', 'Glúteos'],
  ['Ombros 1', 'Ombros'], ['Ombros 2', 'Ombros'], ['Ombros 3', 'Ombros'],
  ['Antebraços 1', 'Antebraços'], ['Antebraços 2', 'Antebraços'], ['Antebraços 3', 'Antebraços'],
  ['Core 1', 'Core'], ['Core 2', 'Core'], ['Core 3', 'Core'],
].map(([name, muscleGroup], index) => ({ id: `split-${index}`, name, muscleGroup, equipment: 'Peso corporal' }));

const hypertrophyAb: GenerationSelection = { division: 'AB', focus: 'HYPERTROPHY' };

describe('versioned workout generator', () => {
  it('is deterministic and records the selected division and focus', () => {
    const first = generateWorkoutProposal(profile, catalog, hypertrophyAb);
    expect(generateWorkoutProposal(profile, catalog, hypertrophyAb)).toEqual(first);
    expect(first.ruleVersion).toBe(WORKOUT_RULE_VERSION);
    expect(first.inputs).toMatchObject({ selectedDivision: 'AB', focus: 'HYPERTROPHY', hasPhysicalRestrictions: false });
    expect(first.division).toBe('AB');
    expect(first.exercises.every((exercise) => exercise.dayIndex < 2)).toBe(true);
  });

  it('limits high-load suggestions when restrictions are present', () => {
    const result = generateWorkoutProposal({ ...profile, physicalRestrictions: 'Informada pelo usuário' }, catalog, { division: 'FULL_BODY', focus: 'STRENGTH' });
    expect(result.exercises.some((exercise) => exercise.name === 'Agachamento livre')).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('restrições físicas'))).toBe(true);
  });

  it('uses distinct evidence-based prescriptions for strength and hypertrophy', () => {
    const strength = generateWorkoutProposal(profile, catalog, { division: 'ABC', focus: 'STRENGTH' });
    const hypertrophy = generateWorkoutProposal(profile, catalog, { division: 'ABC', focus: 'HYPERTROPHY' });
    expect(strength.exercises.every((exercise) => ['4–6', '6–8'].includes(exercise.targetReps) && exercise.restSeconds >= 90)).toBe(true);
    expect(hypertrophy.exercises.every((exercise) => ['6–10', '10–15'].includes(exercise.targetReps) && exercise.targetSets >= 3)).toBe(true);
    expect(strength.name).toContain('Força');
    expect(hypertrophy.name).toContain('Hipertrofia');
  });

  it.each([
    ['FULL_BODY', 1], ['AB', 2], ['ABC', 3], ['ABCD', 4], ['ABCDE', 5],
  ] as const)('generates the %s division with %i distinct day(s)', (division, expectedDays) => {
    const result = generateWorkoutProposal(profile, splitCatalog, { division, focus: 'HYPERTROPHY' });
    expect(result.division).toBe(division);
    expect(result.dayLabels).toHaveLength(expectedDays);
    expect(new Set(result.exercises.map((exercise) => exercise.dayIndex)).size).toBe(expectedDays);
  });

  it('keeps an ABCDE plan inside the muscle sectors assigned to each day', () => {
    const result = generateWorkoutProposal(profile, splitCatalog, { division: 'ABCDE', focus: 'HYPERTROPHY' });
    const expectedGroups = [
      new Set(['Peito', 'Tríceps']),
      new Set(['Costas', 'Bíceps']),
      new Set(['Pernas', 'Glúteos']),
      new Set(['Ombros', 'Antebraços']),
      new Set(['Bíceps', 'Tríceps', 'Core']),
    ];
    result.exercises.forEach((exercise) => expect(expectedGroups[exercise.dayIndex].has(exercise.muscleGroup)).toBe(true));
  });

  it('prioritizes familiar network-gym exercises for the chosen focus', () => {
    const result = generateWorkoutProposal(profile, catalog, { division: 'ABC', focus: 'HYPERTROPHY' });
    expect(result.exercises.find((exercise) => exercise.dayIndex === 0 && exercise.muscleGroup === 'Peito')?.name).toBe('Supino máquina');
    expect(result.exercises.find((exercise) => exercise.dayIndex === 1 && exercise.muscleGroup === 'Costas')?.name).toBe('Remada baixa');
  });
});
