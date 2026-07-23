import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { workoutPlanSchema } from "@/lib/workout/schemas";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.workoutPlan.findFirst({
    where: { id, userId: session.userId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!owned) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  const parsed = workoutPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Plano inválido." }, { status: 400 });
  if (parsed.data.generationRuleVersion && !session.user.profile) return NextResponse.json({ error: "Complete o perfil antes de confirmar uma sugestão." }, { status: 422 });
  const exerciseIds = [...new Set(parsed.data.exercises.map((exercise) => exercise.exerciseId))];
  if ((await db.exercise.count({ where: { id: { in: exerciseIds } } })) !== exerciseIds.length) {
    return NextResponse.json({ error: "Um ou mais exercícios não estão disponíveis." }, { status: 400 });
  }
  const nextVersion = (owned.versions[0]?.version ?? 0) + 1;
  await db.$transaction([
    db.workoutPlan.update({ where: { id }, data: { name: parsed.data.name, division: parsed.data.division, active: true } }),
    db.workoutPlanVersion.create({
      data: { planId: id, version: nextVersion, generatedByRuleVersion: parsed.data.generationRuleVersion ?? null, generationInputs: parsed.data.generationRuleVersion && session.user.profile ? { objective: session.user.profile.objective, trainingExperience: session.user.profile.trainingExperience, trainingDaysPerWeek: session.user.profile.trainingDaysPerWeek, hasPhysicalRestrictions: Boolean(session.user.profile.physicalRestrictions?.trim()), availableEquipment: session.user.profile.availableEquipment, priorityMuscleGroups: session.user.profile.priorityMuscleGroups } : undefined, reviewedAt: parsed.data.generationRuleVersion ? new Date() : null, exercises: { create: parsed.data.exercises } },
    }),
    db.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "workout_plan.version.create",
        objectType: "WorkoutPlan",
        objectId: id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { version: nextVersion, generatedByRuleVersion: parsed.data.generationRuleVersion ?? null, reviewedBeforeActivation: Boolean(parsed.data.generationRuleVersion) },
      },
    }),
  ]);
  return NextResponse.json({ planId: id, version: nextVersion });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const deleted = await db.$transaction(async (transaction) => {
    const result = await transaction.workoutPlan.deleteMany({ where: { id, userId: session.userId } });
    if (result.count) {
      await transaction.auditEvent.create({
        data: {
          actorUserId: session.userId,
          action: "workout_plan.delete",
          objectType: "WorkoutPlan",
          objectId: id,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: { workoutHistoryPreserved: true },
        },
      });
    }
    return result.count;
  });
  if (!deleted) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
