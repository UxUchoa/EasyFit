import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { ensureExerciseCatalog, STARTER_TEMPLATE } from "@/lib/workout/catalog";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  await ensureExerciseCatalog();
  const existing = await db.workoutPlan.findFirst({
    where: { userId: session.userId, name: STARTER_TEMPLATE.name, active: true },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ planId: existing.id, existing: true });

  const names = STARTER_TEMPLATE.days.flat();
  const exercises = await db.exercise.findMany({ where: { name: { in: [...names] } } });
  const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
  const planExercises = STARTER_TEMPLATE.days.flatMap((day, dayIndex) =>
    day.map((name, position) => ({
      exerciseId: byName.get(name)!.id,
      dayIndex,
      position,
      targetSets: name === "Prancha" ? 3 : 3,
      targetReps: name === "Prancha" ? "20–40 s" : "8–12",
      restSeconds: name === "Prancha" ? 45 : 75,
    })),
  );

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.workoutPlan.create({
      data: {
        userId: session.userId,
        name: STARTER_TEMPLATE.name,
        division: "FULL_BODY",
        versions: { create: { version: 1, exercises: { create: planExercises } } },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "workout_plan.template.apply",
        objectType: "WorkoutPlan",
        objectId: created.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { template: "starter_full_body_3_days" },
      },
    });
    return created;
  });
  return NextResponse.json({ planId: plan.id }, { status: 201 });
}
