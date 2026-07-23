import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { mealLabel } from '@/lib/diary/constants';
import { db } from '@/lib/db';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';
const createSchema = z.object({ mealId: z.string().cuid(), name: z.string().trim().min(2).max(80).optional() });

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
  const savedMeals = await db.savedMeal.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: 'desc' },
    include: { items: { orderBy: { position: 'asc' } } },
    take: 50,
  });
  return NextResponse.json({ savedMeals });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitacao nao autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Escolha uma refeicao valida.' }, { status: 400 });
  const meal = await db.meal.findFirst({
    where: { id: parsed.data.mealId, dayLog: { userId: session.userId } },
    include: { entries: { orderBy: { createdAt: 'asc' }, take: 60 } },
  });
  if (!meal) return NextResponse.json({ error: 'Refeicao nao encontrada.' }, { status: 404 });
  if (!meal.entries.length) return NextResponse.json({ error: 'Adicione ao menos um item antes de salvar.' }, { status: 400 });
  const items = meal.entries.map((entry, position) => ({
    position,
    sourceMealEntryId: entry.id,
    quantity: entry.quantity,
    unit: entry.unit,
    snapshotName: entry.snapshotName,
    snapshotBrand: entry.snapshotBrand,
    snapshotSource: entry.snapshotSource,
    snapshotCalories: entry.snapshotCalories,
    snapshotProtein: entry.snapshotProtein,
    snapshotCarbohydrate: entry.snapshotCarbohydrate,
    snapshotFat: entry.snapshotFat,
    macrosComplete: entry.macrosComplete,
  }));
  const saved = await db.$transaction(async (tx) => {
    const created = await tx.savedMeal.create({
    data: { userId: session.userId, name: parsed.data.name ?? mealLabel(meal.slug, meal.customName), items: { create: items } },
    include: { items: { orderBy: { position: 'asc' } } },
    });
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: 'saved_meal.create', objectType: 'SavedMeal', objectId: created.id, result: 'SUCCESS', correlationId: randomUUID(), context: { itemCount: created.items.length } } });
    return created;
  });
  return NextResponse.json({ savedMeal: saved }, { status: 201 });
}
