import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession, rotateCurrentSessionIfDue } from '@/lib/auth/session';
import { hasTrustedOrigin } from '@/lib/security/request';
import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const rotated = await rotateCurrentSessionIfDue(session);
  if (rotated) await db.auditEvent.create({ data: { actorUserId: session.userId, action: 'session.rotate', objectType: 'Session', objectId: session.id, result: 'SUCCESS', correlationId: randomUUID() } });
  return NextResponse.json({ rotated }, { headers: { 'Cache-Control': 'private, no-store' } });
}
