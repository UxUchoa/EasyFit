import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { hasTrustedOrigin } from '@/lib/security/request';
import { isCompatibleAlternative } from '@/lib/workout/substitution';

export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string; exerciseId: string }> };
const substitutionSchema = z.object({
  replacementExerciseId: z.string().cuid(),
  reason: z.enum(['EQUIPMENT_UNAVAILABLE', 'COMFORT', 'PREFERENCE', 'OTHER']),
});

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const parsed = substitutionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Substituição inválida.' }, { status: 400 });
  const { id, exerciseId } = await context.params;
  const current = await db.workoutSessionExercise.findFirst({
    where: { id: exerciseId, session: { id, userId: session.userId, status: 'IN_PROGRESS' } },
    include: { sets: { where: { completedAt: { not: null } }, select: { id: true } } },
  });
  if (!current) return NextResponse.json({ error: 'Exercício da sessão não encontrado.' }, { status: 404 });
  if (current.sets.length) return NextResponse.json({ error: 'Substitua antes de concluir a primeira série deste exercício.' }, { status: 409 });
  const replacement = await db.exercise.findUnique({ where: { id: parsed.data.replacementExerciseId } });
  if (!replacement || !isCompatibleAlternative(
    { id: current.exerciseId ?? current.id, muscleGroup: current.muscleSnapshot, equipment: current.equipmentSnapshot },
    { id: replacement.id, muscleGroup: replacement.muscleGroup, equipment: replacement.equipment },
    session.user.profile?.availableEquipment ?? [],
  )) return NextResponse.json({ error: 'A alternativa não respeita o grupo muscular ou equipamento disponível.' }, { status: 400 });

  const updated = await db.$transaction(async (transaction) => {
    const changed = await transaction.workoutSessionExercise.update({
      where: { id: current.id },
      data: {
        replacedFromExerciseId: current.replacedFromExerciseId ?? current.exerciseId,
        replacedFromNameSnapshot: current.replacedFromNameSnapshot ?? current.nameSnapshot,
        replacedFromMuscleSnapshot: current.replacedFromMuscleSnapshot ?? current.muscleSnapshot,
        replacedFromEquipmentSnapshot: current.replacedFromEquipmentSnapshot ?? current.equipmentSnapshot,
        exerciseId: replacement.id,
        nameSnapshot: replacement.name,
        muscleSnapshot: replacement.muscleGroup,
        equipmentSnapshot: replacement.equipment,
        substitutionReason: parsed.data.reason,
        substitutedAt: new Date(),
      },
    });
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'workout_exercise.substitute', objectType: 'WorkoutSessionExercise', objectId: current.id, result: 'SUCCESS', correlationId: randomUUID(), context: { fromExerciseId: current.exerciseId, toExerciseId: replacement.id, reason: parsed.data.reason } } });
    return changed;
  });
  return NextResponse.json({ exercise: updated });
}
