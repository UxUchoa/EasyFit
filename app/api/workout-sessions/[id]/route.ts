import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
const statusSchema = z.object({ status: z.enum(["COMPLETED", "CANCELLED"]) });

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const workout = await db.workoutSession.findFirst({
    where: { id, userId: session.userId },
    include: {
      exercises: {
        orderBy: { position: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
    },
  });
  if (!workout) return NextResponse.json({ error: "Treino não encontrado." }, { status: 404 });
  return NextResponse.json({ workout });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  const owned = await db.workoutSession.findFirst({
    where: { id, userId: session.userId, status: "IN_PROGRESS" },
    include: { exercises: { include: { sets: { where: { completedAt: { not: null } } } } } },
  });
  if (!owned) return NextResponse.json({ error: "Treino em andamento não encontrado." }, { status: 404 });
  if (parsed.data.status === "COMPLETED" && !owned.exercises.some((item) => item.sets.length > 0)) {
    return NextResponse.json({ error: "Registre ao menos uma série antes de concluir." }, { status: 400 });
  }
  const completedAt = new Date();
  await db.$transaction([
    db.workoutSession.update({
      where: { id },
      data: { status: parsed.data.status, completedAt },
    }),
    db.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: parsed.data.status === "COMPLETED" ? "workout_session.complete" : "workout_session.cancel",
        objectType: "WorkoutSession",
        objectId: id,
        result: "SUCCESS",
        correlationId: randomUUID(),
      },
    }),
  ]);
  return NextResponse.json({ status: parsed.data.status, completedAt });
}
