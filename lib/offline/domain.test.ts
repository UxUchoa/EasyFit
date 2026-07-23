import { describe, expect, it } from 'vitest';
import { bodyForLocalConflictResolution, classifySyncResponse } from './domain';

describe('offline synchronization policy', () => {
  it('separates success, conflict, authentication and terminal validation failures', () => {
    expect(classifySyncResponse(201, false)).toBe('COMPLETE');
    expect(classifySyncResponse(409, true)).toBe('CONFLICT');
    expect(classifySyncResponse(401, false)).toBe('AUTH_REQUIRED');
    expect(classifySyncResponse(400, false)).toBe('FAILED');
  });

  it('only rebases a local choice after explicit conflict resolution', () => {
    const conflict = { entryId: 'entry', server: { quantity: 2, updatedAt: '2026-07-22T20:00:00.000Z' }, client: { quantity: 3 } };
    expect(bodyForLocalConflictResolution({ quantity: 3, reason: 'Ajuste offline' }, conflict)).toEqual({ quantity: 3, reason: 'Ajuste offline', expectedUpdatedAt: conflict.server.updatedAt });
  });
});

