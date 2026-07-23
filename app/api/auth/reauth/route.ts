import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentSession, markCurrentSessionReauthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { consumeLoginAttempt } from "@/lib/security/rate-limit";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({ password: z.string().min(1).max(128) });

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  const rateKey = createHash("sha256").update(`reauth:${session.id}`).digest("hex");
  const limit = await consumeLoginAttempt(rateKey);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde e tente novamente." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    await db.auditEvent.create({ data: { actorUserId: session.userId, action: "session.reauthenticate", objectType: "Session", objectId: session.id, result: "DENIED", correlationId: randomUUID() } });
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }
  await markCurrentSessionReauthenticated(session.id);
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: "session.reauthenticate", objectType: "Session", objectId: session.id, result: "SUCCESS", correlationId: randomUUID() } });
  return NextResponse.json({ verified: true, validForSeconds: 300 });
}
