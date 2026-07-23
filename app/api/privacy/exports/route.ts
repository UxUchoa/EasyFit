import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, isRecentlyReauthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { validExportTtlHours } from "@/lib/privacy/policy";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

function receiptCode() {
  return `EXP-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const requests = await db.subjectRequest.findMany({
    where: { userId: session.userId, kind: "EXPORT" },
    orderBy: { requestedAt: "desc" },
    take: 20,
    select: { id: true, receiptCode: true, status: true, requestedAt: true, completedAt: true, expiresAt: true },
  });
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!isRecentlyReauthenticated(session)) {
    return NextResponse.json({ error: "Confirme sua senha novamente para exportar.", reauthenticationRequired: true }, { status: 403 });
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validExportTtlHours() * 60 * 60 * 1000);
  const result = await db.$transaction(async (tx) => {
    const created = await tx.subjectRequest.create({
      data: {
        userId: session.userId,
        kind: "EXPORT",
        status: "COMPLETED",
        receiptCode: receiptCode(),
        completedAt: now,
        expiresAt,
        artifactKey: "authenticated-dynamic-json",
        resultSummary: "Exportação JSON disponível por canal autenticado.",
      },
    });
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: "privacy.export.request", objectType: "SubjectRequest", objectId: created.id, result: "SUCCESS", correlationId: randomUUID() } });
    return created;
  });
  return NextResponse.json({ request: { id: result.id, receiptCode: result.receiptCode, status: result.status, expiresAt: result.expiresAt, downloadUrl: `/api/privacy/exports/${result.id}/download` } }, { status: 201 });
}
