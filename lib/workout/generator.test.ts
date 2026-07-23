import { describe, expect, it } from 'vitest';
import { generateWorkoutProposal, WORKOUT_RULE_VERSION, type GenerationExercise, type GenerationProfile } from './generator';

const catalog: GenerationExercise[] = [
  { id: '1', name: 'Agachamento livre', muscleGroup: 'Pernas', equipment: 'Barra' },
  { id: '2', name: 'Leg press', muscleGroup: 'Pernas', equipment: 'Máquinas' },
  { id: '3', name: 'Flexão', muscleGroup: 'Peito', equipment: 'Peso corporal' },
  { id: '4', name: 'Remada', muscleGroup: 'Costas', equipment: 'Halteres' },
  { id: '5', name: 'Prancha', muscleGroup: 'Core', equipment: 'Peso corporal' },
  { id: '6', name: 'Elevação', muscleGroup: 'Ombros', equipment: 'Halteres' },
];
const profile: GenerationProfile = { objective: 'maintain', trainingExperience: 'beginner', trainingDaysPerWeek: 2, physicalRestrictions: null, availableEquipment: ['Halteres'], priorityMuscleGroups: ['Costas'] };

const splitCatalog: GenerationExercise[] = [
  ['Peito 1', 'Peito'], ['Peito 2', 'Peito'],
  ['Tríceps 1', 'Tríceps'], ['Tríceps 2', 'Tríceps'],
  ['Costas 1', 'Costas'], ['Costas 2', 'Costas'],
  ['Bíceps 1', 'Bíceps'], ['Bíceps 2', 'Bíceps'],
  ['Pernas 1', 'Pernas'], ['Pernas 2', 'Pernas'],
  ['Glúteos 1', 'Glúteos'], ['Glúteos 2', 'Glúteos'],
  ['Ombros 1', 'Ombros'], ['Ombros 2', 'Ombros'],
  ['Antebraços 1', 'Antebraços'], ['Antebraços 2', 'Antebraços'],
  ['Core 1', 'Core'], ['Core 2', 'Core'],
].map(([name, muscleGroup], index) => ({ id: `split-${index}`, name, muscleGroup, equipment: 'Peso corporal' }));

describe('versioned workout generator', () => {
  it('is deterministic and records the rule/input version', () => {
    const first = generateWorkoutProposal(profile, catalog);
    expect(generateWorkoutProposal(profile, catalog)).toEqual(first);
    expect(first.ruleVersion).toBe(WORKOUT_RULE_VERSION);
    expect(first.inputs).toMatchObject({ objective: 'maintain', trainingDaysPerWeek: 2, hasPhysicalRestrictions: false });
    expect(first.exercises.every((exercise) => exercise.dayIndex < 2)).toBe(true);
  });

  it('limits high-load suggestions when restrictions are present', () => {
    const result = generateWorkoutProposal({ ...profile, physicalRestrictions: 'Informada pelo usuário', availableEquipment: [] }, catalog);
    expect(result.exercises.some((exercise) => exercise.name === 'Agachamento livre')).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('restrições físicas'))).toBe(true);
  });

  it('uses objective-specific set, repetition and rest rules', () => {
    const result = generateWorkoutProposal({ ...profile, objective: 'gain', trainingExperience: 'advanced' }, catalog);
    expect(result.exercises[0]).toMatchObject({ targetSets: 4, targetReps: '6–10', restSeconds: 90 });
  });

  it('keeps an ABCDE plan inside the muscle sectors assigned to each day', () => {
    const result = generateWorkoutProposal({ ...profile, trainingDaysPerWeek: 5, availableEquipment: [] }, splitCatalog);
    const expectedGroups = [
      new Set(['Peito', 'Tríceps']),
      new Set(['Costas', 'Bíceps']),
      new Set(['Pernas', 'Glúteos']),
      new Set(['Ombros', 'Antebraços']),
      new Set(['Bíceps', 'Tríceps', 'Core']),
    ];

    expect(result.division).toBe('ABCDE');
    expect(result.dayLabels).toEqual(['Peito e tríceps', 'Costas e bíceps', 'Pernas completas', 'Ombros e antebraços', 'Braços e core']);
    result.exercises.forEach((exercise) => expect(expectedGroups[exercise.dayIndex].has(exercise.muscleGroup)).toBe(true));
  });

  it('identifies full body as a separate division', () => {
    const result = generateWorkoutProposal({ ...profile, trainingDaysPerWeek: 1, availableEquipment: [] }, splitCatalog);
    expect(result.division).toBe('FULL_BODY');
    expect(result.name).toContain('Full body');
  });
});
