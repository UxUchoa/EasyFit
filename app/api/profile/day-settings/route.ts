import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { isSupportedTimeZone } from '@/lib/diary/date';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
const schema = z.object({
  timezone: z.string().trim().min(3).max(64).refine(isSupportedTimeZone, 'Fuso horario invalido.'),
  dayClosesAtMinutes: z.coerce.number().int().min(0).max(1439),
});

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitacao nao autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Configuracao invalida.' }, { status: 400 });
  const profile = await db.profile.update({ where: { userId: session.userId }, data: parsed.data });
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: 'profile.day_settings.change', objectType: 'Profile', objectId: profile.id, result: 'SUCCESS', correlationId: randomUUID(), context: parsed.data } });
  return NextResponse.json({ timezone: profile.timezone, dayClosesAtMinutes: profile.dayClosesAtMinutes });
}
