import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { reviewImportItem } from '@/lib/imports/service';
import { hasTrustedOrigin } from '@/lib/security/request';
import { recordAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

const reviewSchema = z.object({
  decision: z.enum(['PENDING', 'KEEP', 'REPLACE', 'IGNORE', 'MANUAL']),
  name: z.string().trim().max(180).nullable().optional(),
  quantity: z.number().positive().max(100_000).nullable().optional(),
  unit: z.string().trim().max(24).nullable().optional(),
}).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisão inválida.' }, { status: 400 });
  const { id, itemId } = await context.params;
  try {
    const item = await reviewImportItem(session.userId, id, itemId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível revisar o item.';
    await recordAuditEvent({ actorUserId: session.userId, action: 'diet_import.item_review_denied', objectType: 'ImportItem', objectId: itemId, result: 'DENIED', context: { importJobId: id, reason: message.includes('não encontrado') ? 'NOT_FOUND_OR_NOT_OWNED' : 'INVALID_REVIEW' } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: message.includes('não encontrado') ? 404 : 400 });
  }
}
