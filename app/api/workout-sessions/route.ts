import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { ensureDayLog } from "@/lib/diary/service";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const startSchema = z.object({
  planId: z.string().cuid(),
  dayIndex: z.coerce.number().int().min(0).max(6),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const active = await db.workoutSession.findFirst({
    where: { userId: session.userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (active) {
    return NextResponse.json(
      { error: "Já existe um treino em andamento.", sessionId: active.id },
      { status: 409 },
    );
  }
  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Plano ou dia inválido." }, { status: 400 });
  const plan = await db.workoutPlan.findFirst({
    where: { id: parsed.data.planId, userId: session.userId, active: true },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          exercises: {
            where: { dayIndex: parsed.data.dayIndex },
            orderBy: { position: "asc" },
            include: { exercise: true },
          },
        },
      },
    },
  });
  const version = plan?.versions[0];
  if (!plan || !version || version.exercises.length === 0) {
    return NextResponse.json({ error: "Plano ou dia de treino não encontrado." }, { status: 404 });
  }
  const timezone = session.user.profile?.timezone ?? "America/Sao_Paulo";
  const dateKey = logicalDateKey(new Date(), timezone, session.user.profile?.dayClosesAtMinutes ?? 0);
  const dayLog = await ensureDayLog(session.userId, parseLogicalDate(dateKey)!, timezone);
  const now = new Date();
  const workout = await db.$transaction(async (tx) => {
    const created = await tx.workoutSession.create({
      data: {
        userId: session.userId,
        dayLogId: dayLog.id,
        planId: plan.id,
        planVersionId: version.id,
        status: "IN_PROGRESS",
        name: `${plan.name} · Dia ${parsed.data.dayIndex + 1}`,
        startedAt: now,
        exercises: {
          create: version.exercises.map((item) => ({
            exerciseId: item.exerciseId,
            position: item.position,
            nameSnapshot: item.exercise.name,
            muscleSnapshot: item.exercise.muscleGroup,
            equipmentSnapshot: item.exercise.equipment,
            targetSets: item.targetSets,
            targetReps: item.targetReps,
            restSeconds: item.restSeconds,
          })),
        },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "workout_session.start",
        objectType: "WorkoutSession",
        objectId: created.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { planId: plan.id, version: version.version, dayIndex: parsed.data.dayIndex },
      },
    });
    return created;
  });
  return NextResponse.json({ sessionId: workout.id }, { status: 201 });
}
