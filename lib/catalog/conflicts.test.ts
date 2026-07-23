import { describe, expect, it } from 'vitest';
import { foodConflictGroups, foodConflictKey } from './conflicts';

describe('food source conflicts', () => {
  it('uses GTIN before text and normalizes accents and spacing', () => {
    expect(foodConflictKey({ barcode: '7891234567895', name: 'Qualquer', brand: null, baseUnit: 'g' })).toBe('gtin:7891234567895');
    expect(foodConflictKey({ barcode: null, name: '  Maçã   Gala ', brand: 'Sítio', baseUnit: 'G' })).toBe(foodConflictKey({ barcode: null, name: 'maca gala', brand: 'sitio', baseUnit: 'g' }));
  });

  it('only marks a conflict when equivalent candidates have distinct sources', () => {
    const base = { name: 'Arroz', brand: null, barcode: null, baseUnit: 'g' };
    expect(foodConflictGroups([{ id: '1', source: 'TACO', ...base }, { id: '2', source: 'USDA', ...base }]).size).toBe(1);
    expect(foodConflictGroups([{ id: '1', source: 'PRIVATE', ...base }, { id: '2', source: 'PRIVATE', ...base }]).size).toBe(0);
  });
});
