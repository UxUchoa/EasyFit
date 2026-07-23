import { describe, expect, it } from 'vitest';
import { canGrantScopes, canViewAudit, isStaffRole, supportAccessIsActive } from './policy';

describe('administrative least privilege', () => {
  it('keeps regular users outside the backoffice and audit admin-only', () => {
    expect(isStaffRole('USER')).toBe(false);
    expect(isStaffRole('SUPPORT')).toBe(true);
    expect(canViewAudit('SUPPORT')).toBe(false);
    expect(canViewAudit('ADMIN')).toBe(true);
  });

  it('requires an explicit non-empty supported scope', () => {
    expect(canGrantScopes('USER', ['ACCOUNT_METADATA'])).toBe(false);
    expect(canGrantScopes('SUPPORT', [])).toBe(false);
    expect(canGrantScopes('SUPPORT', ['IMPORT_STATUS'])).toBe(true);
  });

  it('expires or revokes exceptional access', () => {
    const now = new Date('2026-07-22T20:00:00.000Z');
    expect(supportAccessIsActive({ expiresAt: new Date('2026-07-22T20:15:00.000Z'), revokedAt: null }, now)).toBe(true);
    expect(supportAccessIsActive({ expiresAt: now, revokedAt: null }, now)).toBe(false);
    expect(supportAccessIsActive({ expiresAt: new Date('2026-07-22T20:15:00.000Z'), revokedAt: now }, now)).toBe(false);
  });
});
