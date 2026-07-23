import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const now = new Date();
  const result = await db.session.updateMany({
    where: { userId: current.userId, id: { not: current.id }, revokedAt: null },
    data: { revokedAt: now },
  });
  await db.auditEvent.create({ data: { actorUserId: current.userId, action: "session.revoke_others", objectType: "Session", objectId: current.id, result: "SUCCESS", correlationId: randomUUID(), context: { revokedCount: result.count } } });
  return NextResponse.json({ revokedCount: result.count });
}
