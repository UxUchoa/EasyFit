import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logicalDateKey } from '@/lib/diary/date';
import { diaryEntryResponse } from '@/lib/diary/response';
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

const updateEntrySchema = z.object({
  quantity: z.coerce.number().positive().max(100_000),
  reason: z.string().trim().min(2).max(160).optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

class EntryConflictError extends Error {}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });

  const owned = await db.mealEntry.findFirst({
    where: { id, meal: { dayLog: { userId: session.userId } } },
    include: { meal: { select: { dayLog: { select: { logicalDate: true } } } } },
  });
  if (!owned) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  const conflictResponse = async (current: { quantity: unknown; updatedAt: Date }) => {
    await db.auditEvent.create({ data: { actorUserId: session.userId, action: 'meal_entry.update_conflict', objectType: 'MealEntry', objectId: id, result: 'DENIED', correlationId: randomUUID(), context: { expectedUpdatedAt: parsed.data.expectedUpdatedAt ?? null, serverUpdatedAt: current.updatedAt.toISOString() } } });
    return NextResponse.json({ error: 'Este registro mudou em outro dispositivo. Escolha qual versão manter.', conflict: { entryId: id, server: { quantity: Number(current.quantity), updatedAt: current.updatedAt.toISOString() }, client: { quantity: parsed.data.quantity } } }, { status: 409 });
  };
  if (parsed.data.expectedUpdatedAt && owned.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt) return conflictResponse(owned);
  const previousQuantity = Number(owned.quantity);
  const factor = parsed.data.quantity / previousQuantity;
  const nextValues = {
    quantity: parsed.data.quantity,
    calories: Number(owned.snapshotCalories) * factor,
    protein: owned.snapshotProtein === null ? null : Number(owned.snapshotProtein) * factor,
    carbohydrate: owned.snapshotCarbohydrate === null ? null : Number(owned.snapshotCarbohydrate) * factor,
    fat: owned.snapshotFat === null ? null : Number(owned.snapshotFat) * factor,
  };
  const logicalDate = owned.meal.dayLog.logicalDate;
  const today = logicalDateKey(new Date(), session.user.profile?.timezone ?? 'America/Sao_Paulo', session.user.profile?.dayClosesAtMinutes ?? 0);
  const retroactive = logicalDate.toISOString().slice(0, 10) < today;
  if (retroactive && !parsed.data.reason) return NextResponse.json({ error: 'Informe o motivo da correção em um dia passado.' }, { status: 400 });
  let result;
  try {
    result = await db.$transaction(async (transaction) => {
    const revision = await transaction.mealEntryRevision.create({ data: {
      userId: session.userId,
      mealEntryId: id,
      logicalDate,
      reason: parsed.data.reason ?? null,
      previousQuantity: owned.quantity,
      previousCalories: owned.snapshotCalories,
      previousProtein: owned.snapshotProtein,
      previousCarbohydrate: owned.snapshotCarbohydrate,
      previousFat: owned.snapshotFat,
      nextQuantity: nextValues.quantity,
      nextCalories: nextValues.calories,
      nextProtein: nextValues.protein,
      nextCarbohydrate: nextValues.carbohydrate,
      nextFat: nextValues.fat,
    } });
    const updated = await transaction.mealEntry.updateMany({
      where: { id, updatedAt: owned.updatedAt },
      data: { quantity: nextValues.quantity, snapshotCalories: nextValues.calories, snapshotProtein: nextValues.protein, snapshotCarbohydrate: nextValues.carbohydrate, snapshotFat: nextValues.fat },
    });
    if (updated.count !== 1) throw new EntryConflictError();
    const entry = await transaction.mealEntry.findUniqueOrThrow({ where: { id } });
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: retroactive ? 'meal_entry.retroactive_correction' : 'meal_entry.update', objectType: 'MealEntry', objectId: id, result: 'SUCCESS', correlationId: randomUUID(), context: { revisionId: revision.id, logicalDate: logicalDate.toISOString().slice(0, 10), previousQuantity, nextQuantity: parsed.data.quantity, retroactive } } });
    return { entry, revision };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof EntryConflictError) {
      const current = await db.mealEntry.findFirst({ where: { id, meal: { dayLog: { userId: session.userId } } }, select: { quantity: true, updatedAt: true } });
      if (current) return conflictResponse(current);
    }
    throw error;
  }
  return NextResponse.json({
    entry: diaryEntryResponse(result.entry, [result.revision]),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.mealEntry.findFirst({
    where: { id, meal: { dayLog: { userId: session.userId } } },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });

  await db.$transaction([
    db.mealEntry.delete({ where: { id } }),
    db.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "meal_entry.delete",
        objectType: "MealEntry",
        objectId: id,
        result: "SUCCESS",
        correlationId: randomUUID(),
      },
    }),
  ]);
  return new NextResponse(null, { status: 204 });
}
