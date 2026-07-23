import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPTIONAL_ANALYTICS_CONSENT, PRIVACY_TEXT_VERSION } from "@/lib/privacy/policy";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
const schema = z.object({ purpose: z.literal(OPTIONAL_ANALYTICS_CONSENT), accepted: z.boolean() });

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Consentimento inválido." }, { status: 400 });
  const now = new Date();
  if (parsed.data.accepted) {
    const active = await db.consentRecord.findFirst({ where: { userId: session.userId, purpose: parsed.data.purpose, revokedAt: null } });
    if (!active) await db.consentRecord.create({ data: { userId: session.userId, purpose: parsed.data.purpose, textVersion: PRIVACY_TEXT_VERSION, acceptedAt: now } });
  } else {
    await db.consentRecord.updateMany({ where: { userId: session.userId, purpose: parsed.data.purpose, revokedAt: null }, data: { revokedAt: now } });
  }
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: parsed.data.accepted ? "consent.accept" : "consent.revoke", objectType: "ConsentRecord", objectId: parsed.data.purpose, result: "SUCCESS", correlationId: randomUUID(), context: { textVersion: PRIVACY_TEXT_VERSION } } });
  return NextResponse.json({ purpose: parsed.data.purpose, accepted: parsed.data.accepted, textVersion: PRIVACY_TEXT_VERSION });
}
