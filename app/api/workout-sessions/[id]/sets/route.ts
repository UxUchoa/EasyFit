import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { exerciseSetSchema } from "@/lib/workout/schemas";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const parsed = exerciseSetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Série inválida." }, { status: 400 });
  }
  const exercise = await db.workoutSessionExercise.findFirst({
    where: {
      id: parsed.data.sessionExerciseId,
      sessionId: id,
      session: { userId: session.userId, status: "IN_PROGRESS" },
    },
  });
  if (!exercise) return NextResponse.json({ error: "Exercício não encontrado neste treino." }, { status: 404 });
  const data = {
    repetitions: parsed.data.repetitions ?? null,
    weightKg: parsed.data.weightKg ?? null,
    effortRpe: parsed.data.effortRpe ?? null,
    completedAt: parsed.data.completed ? new Date() : null,
  };
  const set = await db.exerciseSet.upsert({
    where: {
      sessionExerciseId_setNumber: {
        sessionExerciseId: exercise.id,
        setNumber: parsed.data.setNumber,
      },
    },
    create: { sessionExerciseId: exercise.id, setNumber: parsed.data.setNumber, ...data },
    update: data,
  });
  return NextResponse.json({ set });
}
