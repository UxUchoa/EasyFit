import { describe, expect, it } from 'vitest';
import { isCompatibleAlternative } from './substitution';

const current = { id: 'a', muscleGroup: 'Peito', equipment: 'Barra ou halteres' };

describe('exercise substitution policy', () => {
  it('requires the same muscle group', () => {
    expect(isCompatibleAlternative(current, { id: 'b', muscleGroup: 'Costas', equipment: 'Halteres' }, ['Halteres'])).toBe(false);
  });

  it('accepts available equipment and bodyweight alternatives', () => {
    expect(isCompatibleAlternative(current, { id: 'b', muscleGroup: 'Peito', equipment: 'Halteres' }, ['Halteres'])).toBe(true);
    expect(isCompatibleAlternative(current, { id: 'c', muscleGroup: 'Peito', equipment: 'Peso corporal' }, [])).toBe(true);
  });

  it('rejects equipment outside the users context', () => {
    expect(isCompatibleAlternative(current, { id: 'b', muscleGroup: 'Peito', equipment: 'Máquinas' }, ['Halteres'])).toBe(false);
  });
});
