import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { parseLogicalDate } from '@/lib/diary/date';
import { ensureDayLog } from '@/lib/diary/service';
import { db } from '@/lib/db';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/), kind: z.enum(['PLANNED', 'CONSUMED']).default('CONSUMED') });

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitacao nao autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const logicalDate = parsed.success ? parseLogicalDate(parsed.data.date) : null;
  if (!parsed.success || !logicalDate) return NextResponse.json({ error: 'Destino invalido.' }, { status: 400 });
  const saved = await db.savedMeal.findFirst({
    where: { id, userId: session.userId },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (!saved) return NextResponse.json({ error: 'Refeicao favorita nao encontrada.' }, { status: 404 });
  const idempotencyKey = request.headers.get('idempotency-key')?.trim().slice(0, 48);
  const firstMutationId = idempotencyKey ? `saved:${idempotencyKey}:0` : null;
  if (firstMutationId) {
    const existing = await db.mealEntry.findUnique({
      where: { clientMutationId: firstMutationId },
      include: { meal: { include: { dayLog: { select: { userId: true } } } } },
    });
    if (existing) return existing.meal.dayLog.userId === session.userId
      ? NextResponse.json({ applied: saved.items.length, replayed: true })
      : NextResponse.json({ error: 'Operacao indisponivel.' }, { status: 409 });
  }
  const timezone = session.user.profile?.timezone ?? 'America/Sao_Paulo';
  const day = await ensureDayLog(session.userId, logicalDate, timezone);
  const meal = day.meals.find((candidate) => candidate.slug === parsed.data.mealSlug);
  if (!meal) return NextResponse.json({ error: 'Refeicao de destino nao encontrada.' }, { status: 404 });
  const entries = saved.items.map((item, index) => ({
    clientMutationId: idempotencyKey ? `saved:${idempotencyKey}:${index}` : null,
    copiedFromEntryId: item.sourceMealEntryId,
    mealId: meal.id,
    kind: parsed.data.kind,
    quantity: item.quantity,
    unit: item.unit,
    snapshotName: item.snapshotName,
    snapshotBrand: item.snapshotBrand,
    snapshotSource: item.snapshotSource,
    snapshotCalories: item.snapshotCalories,
    snapshotProtein: item.snapshotProtein,
    snapshotCarbohydrate: item.snapshotCarbohydrate,
    snapshotFat: item.snapshotFat,
    macrosComplete: item.macrosComplete,
  }));
  await db.$transaction(async (tx) => {
    await tx.mealEntry.createMany({ data: entries });
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: 'saved_meal.apply', objectType: 'SavedMeal', objectId: saved.id, result: 'SUCCESS', correlationId: randomUUID(), context: { date: parsed.data.date, mealSlug: parsed.data.mealSlug, itemCount: entries.length } } });
  });
  return NextResponse.json({ applied: entries.length }, { status: 201 });
}
