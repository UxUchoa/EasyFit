import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { ensureExerciseCatalog } from "@/lib/workout/catalog";
import { buildWorkoutImportProposal, validateWorkoutJsonUpload, WORKOUT_IMPORT_MAX_BYTES } from "@/lib/workout/import";

export const runtime = "nodejs";

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(100),
  content: z.string().min(1).max(WORKOUT_IMPORT_MAX_BYTES),
}).strict();

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Arquivo inválido." }, { status: 400 });

  try {
    const validated = validateWorkoutJsonUpload(parsed.data);
    const catalog = await ensureExerciseCatalog() ?? await db.exercise.findMany({ select: { id: true, name: true } });
    const result = buildWorkoutImportProposal(validated.data, catalog);
    if (result.unresolved.length) {
      return NextResponse.json({
        error: `Não encontramos ${result.unresolved.length === 1 ? "o exercício" : "os exercícios"}: ${result.unresolved.join(", ")}. Use os nomes disponíveis no catálogo.`,
        unresolved: result.unresolved,
      }, { status: 422 });
    }
    const correlationId = randomUUID();
    await db.auditEvent.create({ data: {
      actorUserId: session.userId,
      action: "workout_import.validated",
      objectType: "WorkoutImportProposal",
      objectId: correlationId,
      result: "SUCCESS",
      correlationId,
      context: { filename: parsed.data.filename, byteSize: validated.byteSize, exerciseCount: result.proposal.exercises.length },
    } });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar o treino." }, { status: 400 });
  }
}
