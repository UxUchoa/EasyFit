import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { measurementData, measurementSchema, syncCurrentWeight } from '@/lib/profile/measurement';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const parsed = measurementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Medição inválida.' }, { status: 400 });
  const data = measurementData(parsed.data);
  const measurement = await db.$transaction(async (transaction) => {
    const saved = await transaction.bodyMeasurement.upsert({
      where: { userId_measuredAt: { userId: session.userId, measuredAt: data.measuredAt } },
      create: { userId: session.userId, ...data },
      update: data,
    });
    await syncCurrentWeight(transaction, session.userId);
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'body_measurement.upsert', objectType: 'BodyMeasurement', objectId: saved.id, result: 'SUCCESS', correlationId: randomUUID(), context: { measuredAt: parsed.data.measuredAt } } });
    return saved;
  });
  return NextResponse.json({ measurement }, { status: 201 });
}
