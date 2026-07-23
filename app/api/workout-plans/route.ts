import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { workoutPlanSchema } from "@/lib/workout/schemas";

export const runtime = "nodejs";

function generationMetadata(
  ruleVersion: string | null | undefined,
  profile: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>['user']['profile'],
  selection: { division?: string | null; focus?: string | null },
) {
  if (!ruleVersion || !profile) return { generatedByRuleVersion: null, generationInputs: undefined, reviewedAt: null };
  return { generatedByRuleVersion: ruleVersion, generationInputs: { objective: profile.objective, trainingExperience: profile.trainingExperience, trainingDaysPerWeek: profile.trainingDaysPerWeek, hasPhysicalRestrictions: Boolean(profile.physicalRestrictions?.trim()), availableEquipment: profile.availableEquipment, priorityMuscleGroups: profile.priorityMuscleGroups, selectedDivision: selection.division, focus: selection.focus }, reviewedAt: new Date() };
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const plans = await db.workoutPlan.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { exercises: { include: { exercise: true }, orderBy: [{ dayIndex: "asc" }, { position: "asc" }] } },
      },
    },
  });
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = workoutPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Plano inválido." }, { status: 400 });
  }
  if (parsed.data.generationRuleVersion && !session.user.profile) return NextResponse.json({ error: "Complete o perfil antes de confirmar uma sugestão." }, { status: 422 });
  const exerciseIds = [...new Set(parsed.data.exercises.map((exercise) => exercise.exerciseId))];
  const available = await db.exercise.count({ where: { id: { in: exerciseIds } } });
  if (available !== exerciseIds.length) {
    return NextResponse.json({ error: "Um ou mais exercícios não estão disponíveis." }, { status: 400 });
  }

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.workoutPlan.create({
      data: {
        userId: session.userId,
        name: parsed.data.name,
        division: parsed.data.division,
        versions: { create: { version: 1, ...generationMetadata(parsed.data.generationRuleVersion, session.user.profile, { division: parsed.data.generationDivision, focus: parsed.data.generationFocus }), exercises: { create: parsed.data.exercises } } },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "workout_plan.create",
        objectType: "WorkoutPlan",
        objectId: created.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { generatedByRuleVersion: parsed.data.generationRuleVersion ?? null, division: parsed.data.generationDivision ?? null, focus: parsed.data.generationFocus ?? null, reviewedBeforeActivation: Boolean(parsed.data.generationRuleVersion) },
      },
    });
    return created;
  });
  return NextResponse.json({ plan }, { status: 201 });
}
