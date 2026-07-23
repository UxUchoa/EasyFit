import { describe, expect, it } from 'vitest';
import { assertImportTransition, canTransitionImport, flattenImportItems, reviewBlockingReason, validateJsonUpload } from './domain';

const validContent = JSON.stringify({ name: 'Semana base', days: [{ label: 'Segunda', meals: [{ name: 'Almoço', items: [{ food: 'Arroz', quantity: 100, unit: 'g' }, { food: 'Salada' }] }] }] });

describe('diet import domain', () => {
  it('validates signature, MIME and schema before extracting source pointers', () => {
    const parsed = validateJsonUpload({ filename: 'dieta.json', mimeType: 'application/json', content: validContent });
    const items = flattenImportItems(parsed.data);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ extractedName: 'Arroz', confidence: 1, sourcePointer: '$.days[0].meals[0].items[0]' });
    expect(items[1]).toMatchObject({ extractedQuantity: null, confidence: 0.55 });
    expect(() => validateJsonUpload({ filename: 'dieta.pdf', mimeType: 'application/json', content: validContent })).toThrow(/extensão/);
    expect(() => validateJsonUpload({ filename: 'dieta.json', mimeType: 'application/json', content: '[]' })).toThrow(/assinatura/);
  });

  it('blocks invalid state transitions and keeps terminal states terminal', () => {
    expect(canTransitionImport('PENDING', 'PROCESSING')).toBe(true);
    expect(canTransitionImport('REVIEW', 'COMPLETED')).toBe(true);
    expect(canTransitionImport('COMPLETED', 'PROCESSING')).toBe(false);
    expect(() => assertImportTransition('PENDING', 'COMPLETED')).toThrow(/não permitida/);
  });

  it('never invents a portion and requires an explicit decision', () => {
    const base = { decision: 'PENDING' as const, extractedName: 'Uma fruta', extractedQuantity: null, extractedUnit: null, reviewedName: null, reviewedQuantity: null, reviewedUnit: null };
    expect(reviewBlockingReason(base)).toMatch(/Escolha/);
    expect(reviewBlockingReason({ ...base, decision: 'MANUAL' })).toMatch(/quantidade/);
    expect(reviewBlockingReason({ ...base, decision: 'MANUAL', reviewedQuantity: 1, reviewedUnit: 'un', reviewedName: 'Banana' })).toBeNull();
    expect(reviewBlockingReason({ ...base, decision: 'IGNORE' })).toBeNull();
  });
});
