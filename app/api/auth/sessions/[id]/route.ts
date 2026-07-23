import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, revokeCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.session.findFirst({ where: { id, userId: current.userId, revokedAt: null } });
  if (!owned) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  const now = new Date();
  await db.$transaction([
    db.session.update({ where: { id }, data: { revokedAt: now } }),
    db.auditEvent.create({ data: { actorUserId: current.userId, action: "session.revoke", objectType: "Session", objectId: id, result: "SUCCESS", correlationId: randomUUID(), context: { currentSession: id === current.id } } }),
  ]);
  if (id === current.id) await revokeCurrentSession();
  return NextResponse.json({ revoked: true, current: id === current.id, next: id === current.id ? "/entrar" : null });
}
