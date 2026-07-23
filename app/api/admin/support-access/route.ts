import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession, isRecentlyReauthenticated } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { canGrantScopes, isStaffRole, SUPPORT_ACCESS_MINUTES } from '@/lib/admin/policy';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().trim().min(3).max(40),
  reason: z.string().trim().min(20, 'A justificativa deve ter pelo menos 20 caracteres.').max(500),
  scopes: z.array(z.enum(['ACCOUNT_METADATA', 'IMPORT_STATUS'])).min(1).max(2),
}).strict();

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: 'Recurso não encontrado.' }, { status: 404 });
  const access = await db.supportAccess.findMany({ where: { operatorUserId: session.userId }, orderBy: { createdAt: 'desc' }, take: 20, include: { target: { select: { username: true } }, consulted: { orderBy: { consultedAt: 'desc' }, take: 20 } } });
  return NextResponse.json({ access });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session || !isStaffRole(session.user.role)) return NextResponse.json({ error: 'Recurso não encontrado.' }, { status: 404 });
  if (!isRecentlyReauthenticated(session)) return NextResponse.json({ error: 'Confirme sua senha antes de solicitar acesso.', reauthenticationRequired: true }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Solicitação inválida.' }, { status: 400 });
  if (!canGrantScopes(session.user.role, parsed.data.scopes)) return NextResponse.json({ error: 'Escopo não permitido para este papel.' }, { status: 403 });
  const target = await db.user.findFirst({ where: { username: parsed.data.username, role: 'USER' }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'Conta elegível não encontrada.' }, { status: 404 });
  const expiresAt = new Date(Date.now() + SUPPORT_ACCESS_MINUTES * 60_000);
  const access = await db.$transaction(async (transaction) => {
    const created = await transaction.supportAccess.create({ data: { operatorUserId: session.userId, targetUserId: target.id, reason: parsed.data.reason, scopes: parsed.data.scopes, expiresAt } });
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'admin.support_access.granted', objectType: 'SupportAccess', objectId: created.id, result: 'SUCCESS', correlationId: randomUUID(), context: { targetUserId: target.id, scopes: parsed.data.scopes.join(','), expiresAt: expiresAt.toISOString(), operatorRole: session.user.role } } });
    return created;
  });
  return NextResponse.json({ access }, { status: 201 });
}

