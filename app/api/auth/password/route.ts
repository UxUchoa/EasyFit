import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/auth/schemas";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
  revokeOtherSessions: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Senha inválida." }, { status: 400 });
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.userId }, data: { passwordHash } });
    await tx.session.update({ where: { id: session.id }, data: { reauthenticatedAt: now } });
    if (parsed.data.revokeOtherSessions) {
      await tx.session.updateMany({
        where: { userId: session.userId, id: { not: session.id }, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: "account.password.change", objectType: "User", objectId: session.userId, result: "SUCCESS", correlationId: randomUUID(), context: { revokedOtherSessions: parsed.data.revokeOtherSessions } } });
  });
  return NextResponse.json({ changed: true });
}
