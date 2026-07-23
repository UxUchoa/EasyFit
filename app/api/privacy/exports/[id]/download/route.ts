import { randomUUID } from "node:crypto";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const request = await db.subjectRequest.findFirst({
    where: { id, userId: session.userId, kind: "EXPORT", status: "COMPLETED" },
  });
  if (!request) return Response.json({ error: "Exportação não encontrada." }, { status: 404 });
  if (!request.expiresAt || request.expiresAt <= new Date()) {
    return Response.json({ error: "Esta exportação expirou. Solicite uma nova." }, { status: 410 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      bodyMeasurements: { orderBy: { measuredAt: "asc" } },
      notificationSettings: true,
      notificationPreferences: { orderBy: { type: "asc" } },
      mealEntryRevisions: { orderBy: { correctedAt: "asc" } },
      goals: { orderBy: { validFrom: "asc" } },
      dayLogs: {
        orderBy: { logicalDate: "asc" },
        include: {
          meals: { orderBy: { position: "asc" }, include: { entries: { orderBy: { createdAt: "asc" } } } },
        },
      },
      privateFoods: { include: { portions: true }, orderBy: { createdAt: "asc" } },
      foodFavorites: { include: { food: true }, orderBy: { createdAt: "asc" } },
      foodSourceChoices: { orderBy: { chosenAt: 'asc' } },
      savedMeals: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      importJobs: { include: { items: { orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      dietPlans: { include: { versions: { orderBy: { version: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      supportAccessAsOperator: { include: { consulted: { orderBy: { consultedAt: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      supportAccessAsTarget: { include: { consulted: { orderBy: { consultedAt: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      workoutPlans: {
        orderBy: { createdAt: "asc" },
        include: {
          versions: {
            orderBy: { version: "asc" },
            include: { exercises: { orderBy: [{ dayIndex: "asc" }, { position: "asc" }], include: { exercise: true } } },
          },
        },
      },
      workoutSessions: {
        orderBy: { createdAt: "asc" },
        include: {
          exercises: { orderBy: { position: "asc" }, include: { sets: { orderBy: { setNumber: "asc" } } } },
        },
      },
      consents: { orderBy: { acceptedAt: "asc" } },
      subjectRequests: {
        orderBy: { requestedAt: "asc" },
        select: { receiptCode: true, kind: true, status: true, requestedAt: true, completedAt: true, expiresAt: true },
      },
    },
  });
  if (!user) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: "privacy.export.download", objectType: "SubjectRequest", objectId: request.id, result: "SUCCESS", correlationId: randomUUID() } });
  const payload = JSON.stringify({ schemaVersion: "easyfit-export-1", generatedAt: new Date().toISOString(), receiptCode: request.receiptCode, data: user }, null, 2);
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="easyfit-export-${request.receiptCode}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
