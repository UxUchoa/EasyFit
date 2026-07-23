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
  { id: '12', name: 'Panturrilha em pé na máquina', muscleGroup: 'Panturrilhas', equipment: 'Máquinas' },
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
  ['Peito 1', 'Peito'], ['Peito 2', 'Peito'], ['Peito 3', 'Peito'], ['Peito 4', 'Peito'],
  ['Tríceps 1', 'Tríceps'], ['Tríceps 2', 'Tríceps'], ['Tríceps 3', 'Tríceps'], ['Tríceps 4', 'Tríceps'],
  ['Costas 1', 'Costas'], ['Costas 2', 'Costas'], ['Costas 3', 'Costas'], ['Costas 4', 'Costas'],
  ['Bíceps 1', 'Bíceps'], ['Bíceps 2', 'Bíceps'], ['Bíceps 3', 'Bíceps'], ['Bíceps 4', 'Bíceps'],
  ['Agachamento teste', 'Pernas'], ['Leg press teste', 'Pernas'], ['Cadeira extensora teste', 'Pernas'],
  ['Stiff teste', 'Pernas'], ['Mesa flexora teste', 'Pernas'], ['Cadeira flexora teste', 'Pernas'],
  ['Glúteos 1', 'Glúteos'], ['Glúteos 2', 'Glúteos'], ['Glúteos 3', 'Glúteos'],
  ['Panturrilha 1', 'Panturrilhas'], ['Panturrilha 2', 'Panturrilhas'], ['Panturrilha 3', 'Panturrilhas'],
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
    expect(result.exercises.some((exercise) => exercise.muscleGroup === 'Core')).toBe(false);
  });

  it('keeps an ABCDE plan inside the muscle sectors assigned to each day', () => {
    const result = generateWorkoutProposal(profile, splitCatalog, { division: 'ABCDE', focus: 'HYPERTROPHY' });
    const expectedGroups = [
      new Set(['Peito']),
      new Set(['Costas']),
      new Set(['Pernas', 'Glúteos', 'Panturrilhas']),
      new Set(['Ombros']),
      new Set(['Bíceps', 'Tríceps', 'Antebraços']),
    ];
    result.exercises.forEach((exercise) => expect(expectedGroups[exercise.dayIndex].has(exercise.muscleGroup)).toBe(true));
    expect(result.dayLabels[4]).toBe('Bíceps, tríceps e antebraços');
  });

  it('groups the ABCD exercises by sector instead of alternating chest and triceps', () => {
    const orderedCatalog: GenerationExercise[] = [
      { id: 'chest-1', name: 'Supino reto', muscleGroup: 'Peito', equipment: 'Barra ou halteres' },
      { id: 'triceps-1', name: 'Tríceps no cabo', muscleGroup: 'Tríceps', equipment: 'Cabos' },
      { id: 'chest-2', name: 'Supino máquina', muscleGroup: 'Peito', equipment: 'Máquinas' },
      { id: 'triceps-2', name: 'Tríceps corda', muscleGroup: 'Tríceps', equipment: 'Cabos' },
      { id: 'triceps-3', name: 'Tríceps máquina', muscleGroup: 'Tríceps', equipment: 'Máquinas' },
      { id: 'triceps-4', name: 'Tríceps acima da cabeça no cabo', muscleGroup: 'Tríceps', equipment: 'Cabos' },
      { id: 'chest-3', name: 'Supino inclinado com halteres', muscleGroup: 'Peito', equipment: 'Halteres' },
      { id: 'chest-4', name: 'Peck deck', muscleGroup: 'Peito', equipment: 'Máquinas' },
    ];
    const result = generateWorkoutProposal(profile, orderedCatalog, { division: 'ABCD', focus: 'HYPERTROPHY' });
    const dayA = result.exercises.filter((exercise) => exercise.dayIndex === 0);
    expect(dayA.map((exercise) => exercise.muscleGroup)).toEqual(['Peito', 'Peito', 'Peito', 'Peito', 'Tríceps', 'Tríceps', 'Tríceps', 'Tríceps']);
    expect(dayA.slice(0, 3).map((exercise) => exercise.name)).toEqual(['Supino reto', 'Supino inclinado com halteres', 'Supino máquina']);
  });

  it('balances an ABCD back and biceps day and increases direct biceps sets when prioritized', () => {
    const result = generateWorkoutProposal(
      { ...profile, priorityMuscleGroups: ['Bíceps'] },
      splitCatalog,
      { division: 'ABCD', focus: 'HYPERTROPHY' },
    );
    const dayB = result.exercises.filter((exercise) => exercise.dayIndex === 1);
    expect(dayB.filter((exercise) => exercise.muscleGroup === 'Costas')).toHaveLength(4);
    expect(dayB.filter((exercise) => exercise.muscleGroup === 'Bíceps')).toHaveLength(4);
    expect(dayB.filter((exercise) => exercise.muscleGroup === 'Bíceps').every((exercise) => exercise.targetSets === 4)).toBe(true);
  });

  it.each(['AB', 'ABC', 'ABCD', 'ABCDE'] as const)('never returns to a muscle group after leaving its block in %s', (division) => {
    const result = generateWorkoutProposal(profile, splitCatalog, { division, focus: 'HYPERTROPHY' });
    result.dayLabels.forEach((_, dayIndex) => {
      const groups = result.exercises.filter((exercise) => exercise.dayIndex === dayIndex).map((exercise) => exercise.muscleGroup);
      const blocks = groups.filter((group, index) => index === 0 || group !== groups[index - 1]);
      expect(new Set(blocks).size).toBe(blocks.length);
    });
  });

  it.each([
    ['AB', [['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'], ['Pernas', 'Glúteos', 'Panturrilhas']]],
    ['ABC', [['Peito', 'Ombros', 'Tríceps'], ['Costas', 'Bíceps', 'Antebraços'], ['Pernas', 'Glúteos', 'Panturrilhas']]],
    ['ABCD', [['Peito', 'Tríceps'], ['Costas', 'Bíceps'], ['Pernas', 'Glúteos', 'Panturrilhas'], ['Ombros', 'Antebraços']]],
    ['ABCDE', [['Peito'], ['Costas'], ['Pernas', 'Glúteos', 'Panturrilhas'], ['Ombros'], ['Bíceps', 'Tríceps', 'Antebraços']]],
  ] as const)('uses the prescribed sector order in every day of %s', (division, expectedDays) => {
    const result = generateWorkoutProposal(profile, splitCatalog, { division, focus: 'HYPERTROPHY' });
    const actualDays = result.dayLabels.map((_, dayIndex) => {
      const groups = result.exercises.filter((exercise) => exercise.dayIndex === dayIndex).map((exercise) => exercise.muscleGroup);
      return groups.filter((group, index) => index === 0 || group !== groups[index - 1]);
    });
    expect(actualDays).toEqual(expectedDays);
  });

  it('orders a complete leg day as quadriceps, posterior thigh, glutes and calves', () => {
    const legCatalog: GenerationExercise[] = [
      { id: 'quad-1', name: 'Leg press 45°', muscleGroup: 'Pernas', equipment: 'Máquinas' },
      { id: 'quad-2', name: 'Cadeira extensora', muscleGroup: 'Pernas', equipment: 'Máquinas' },
      { id: 'posterior-1', name: 'Stiff com halteres', muscleGroup: 'Pernas', equipment: 'Halteres' },
      { id: 'posterior-2', name: 'Mesa flexora', muscleGroup: 'Pernas', equipment: 'Máquinas' },
      { id: 'glutes-1', name: 'Hip thrust na máquina', muscleGroup: 'Glúteos', equipment: 'Máquinas' },
      { id: 'calves-1', name: 'Panturrilha em pé na máquina', muscleGroup: 'Panturrilhas', equipment: 'Máquinas' },
    ];
    const result = generateWorkoutProposal(profile, legCatalog, { division: 'ABCD', focus: 'HYPERTROPHY' });
    expect(result.exercises.filter((exercise) => exercise.dayIndex === 2).map((exercise) => exercise.name)).toEqual([
      'Leg press 45°', 'Cadeira extensora', 'Stiff com halteres', 'Mesa flexora', 'Hip thrust na máquina', 'Panturrilha em pé na máquina',
    ]);
  });

  it('prioritizes familiar network-gym exercises for the chosen focus', () => {
    const result = generateWorkoutProposal(profile, catalog, { division: 'ABC', focus: 'HYPERTROPHY' });
    expect(result.exercises.find((exercise) => exercise.dayIndex === 0 && exercise.muscleGroup === 'Peito')?.name).toBe('Supino reto');
    expect(result.exercises.find((exercise) => exercise.dayIndex === 1 && exercise.muscleGroup === 'Costas')?.name).toBe('Remada baixa');
  });
});
