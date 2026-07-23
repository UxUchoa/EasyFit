import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isStaffRole } from '@/lib/admin/policy';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: 'Recurso não encontrado.' }, { status: 404 });
  const { id } = await context.params;
  const access = await db.supportAccess.findFirst({ where: { id, operatorUserId: session.userId, revokedAt: null } });
  if (!access) return NextResponse.json({ error: 'Acesso não encontrado.' }, { status: 404 });
  const revoked = await db.$transaction(async (transaction) => {
    const updated = await transaction.supportAccess.update({ where: { id }, data: { revokedAt: new Date() } });
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'admin.support_access.revoked', objectType: 'SupportAccess', objectId: id, result: 'SUCCESS', correlationId: randomUUID(), context: { targetUserId: access.targetUserId, operatorRole: session.user.role } } });
    return updated;
  });
  return NextResponse.json({ access: revoked });
}

