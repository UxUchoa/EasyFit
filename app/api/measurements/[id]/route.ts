import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { calendarDateKey } from '@/lib/diary/date';
import { measurementData, measurementSchemaThrough, syncCurrentWeight } from '@/lib/profile/measurement';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const today = calendarDateKey(new Date(), session.user.profile?.timezone ?? 'America/Sao_Paulo');
  const parsed = measurementSchemaThrough(today).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Medição inválida.' }, { status: 400 });
  const { id } = await context.params;
  const data = measurementData(parsed.data);
  const result = await db.$transaction(async (transaction) => {
    const updated = await transaction.bodyMeasurement.updateMany({ where: { id, userId: session.userId }, data });
    if (!updated.count) return null;
    await syncCurrentWeight(transaction, session.userId);
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'body_measurement.update', objectType: 'BodyMeasurement', objectId: id, result: 'SUCCESS', correlationId: randomUUID(), context: { measuredAt: parsed.data.measuredAt } } });
    return transaction.bodyMeasurement.findUnique({ where: { id } });
  });
  if (!result) return NextResponse.json({ error: 'Medição não encontrada.' }, { status: 404 });
  return NextResponse.json({ measurement: result });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const { id } = await context.params;
  const deleted = await db.$transaction(async (transaction) => {
    const result = await transaction.bodyMeasurement.deleteMany({ where: { id, userId: session.userId } });
    if (!result.count) return false;
    await syncCurrentWeight(transaction, session.userId);
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'body_measurement.delete', objectType: 'BodyMeasurement', objectId: id, result: 'SUCCESS', correlationId: randomUUID() } });
    return true;
  });
  if (!deleted) return NextResponse.json({ error: 'Medição não encontrada.' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
