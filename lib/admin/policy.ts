import type { SupportAccessScope, UserRole } from '@prisma/client';

export const SUPPORT_ACCESS_MINUTES = 15;

export function isStaffRole(role: UserRole): role is 'SUPPORT' | 'ADMIN' {
  return role === 'SUPPORT' || role === 'ADMIN';
}

export function canViewAudit(role: UserRole) {
  return role === 'ADMIN';
}

export function allowedSupportScopes(role: UserRole): SupportAccessScope[] {
  if (role === 'SUPPORT') return ['ACCOUNT_METADATA', 'IMPORT_STATUS'];
  if (role === 'ADMIN') return ['ACCOUNT_METADATA', 'IMPORT_STATUS'];
  return [];
}

export function canGrantScopes(role: UserRole, scopes: SupportAccessScope[]) {
  const allowed = new Set(allowedSupportScopes(role));
  return scopes.length > 0 && scopes.every((scope) => allowed.has(scope));
}

export function supportAccessIsActive(access: { expiresAt: Date; revokedAt: Date | null }, now = new Date()) {
  return access.revokedAt === null && access.expiresAt > now;
}

