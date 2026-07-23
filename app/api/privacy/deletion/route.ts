import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession, isRecentlyReauthenticated, revokeCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SUBJECT_REQUEST_RETENTION_DAYS } from "@/lib/privacy/policy";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({ confirmation: z.string().trim().min(1).max(80) });

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!isRecentlyReauthenticated(session)) {
    return NextResponse.json({ error: "Confirme sua senha novamente para excluir a conta.", reauthenticationRequired: true }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation.toLowerCase() !== session.user.username.toLowerCase()) {
    return NextResponse.json({ error: "Digite exatamente seu ID de usuário para confirmar." }, { status: 400 });
  }
  const now = new Date();
  const receiptCode = `DEL-${randomBytes(10).toString("hex").toUpperCase()}`;
  const retentionDays = Number.isFinite(SUBJECT_REQUEST_RETENTION_DAYS) ? SUBJECT_REQUEST_RETENTION_DAYS : 365;
  const expiresAt = new Date(now.getTime() + Math.max(30, retentionDays) * 86_400_000);
  const requestRecord = await db.$transaction(async (tx) => {
    const created = await tx.subjectRequest.create({
      data: {
        userId: session.userId,
        kind: "DELETION",
        status: "COMPLETED",
        receiptCode,
        completedAt: now,
        expiresAt,
        resultSummary: "Conta e dados ativos associados foram excluídos.",
      },
    });
    await tx.user.delete({ where: { id: session.userId } });
    await tx.auditEvent.create({ data: { actorUserId: null, action: "privacy.deletion.complete", objectType: "SubjectRequest", objectId: created.id, result: "SUCCESS", correlationId: randomUUID(), context: { receiptCode } } });
    return created;
  });
  await revokeCurrentSession();
  return NextResponse.json({ deleted: true, receiptCode: requestRecord.receiptCode, completedAt: requestRecord.completedAt, message: "Conta e dados ativos excluídos." });
}
