import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { confirmImport } from '@/lib/imports/service';
import { hasTrustedOrigin } from '@/lib/security/request';
import { recordAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const { id } = await context.params;
  try {
    const result = await confirmImport(session.userId, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível confirmar a importação.';
    await recordAuditEvent({ actorUserId: session.userId, action: 'diet_import.confirm_denied', objectType: 'ImportJob', objectId: id, result: 'DENIED', context: { reason: message.includes('não encontrada') ? 'NOT_FOUND_OR_NOT_OWNED' : 'INVALID_STATE_OR_REVIEW' } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: message.includes('não encontrada') ? 404 : 400 });
  }
}
