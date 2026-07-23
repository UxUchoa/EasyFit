import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isStaffRole, supportAccessIsActive } from '@/lib/admin/policy';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: 'Recurso não encontrado.' }, { status: 404 });
  const { id } = await context.params;
  const access = await db.supportAccess.findFirst({ where: { id, operatorUserId: session.userId }, include: { target: { select: { id: true, username: true, createdAt: true, onboardingDone: true } } } });
  if (!access || !access.targetUserId || !access.target || !supportAccessIsActive(access)) return NextResponse.json({ error: 'Acesso inexistente, expirado ou revogado.' }, { status: 404 });
  const includeAccount = access.scopes.includes('ACCOUNT_METADATA');
  const includeImports = access.scopes.includes('IMPORT_STATUS');
  const imports = includeImports ? await db.importJob.findMany({ where: { userId: access.targetUserId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, createdAt: true, updatedAt: true, attemptCount: true, parserVersion: true } }) : [];
  const objects = [
    ...(includeAccount ? [{ supportAccessId: access.id, objectType: 'User', objectId: access.targetUserId }] : []),
    ...imports.map((job) => ({ supportAccessId: access.id, objectType: 'ImportJob', objectId: job.id })),
  ];
  await db.$transaction(async (transaction) => {
    if (objects.length) await transaction.supportAccessObject.createMany({ data: objects });
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'admin.support_access.consulted', objectType: 'SupportAccess', objectId: access.id, result: 'SUCCESS', correlationId: randomUUID(), context: { targetUserId: access.targetUserId, objectCount: objects.length, scopes: access.scopes.join(','), operatorRole: session.user.role } } });
  });
  return NextResponse.json({
    access: { id: access.id, scopes: access.scopes, expiresAt: access.expiresAt },
    account: includeAccount ? access.target : null,
    imports,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
