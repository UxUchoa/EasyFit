import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  consumeComparablePasswordTime,
  verifyPassword,
} from "@/lib/auth/password";
import { credentialsSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/observability/logger";
import { recordOperationalMetricSafely } from '@/lib/observability/metrics';
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/security/rate-limit";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

function rateLimitKey(request: NextRequest, username: string) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(`${address}:${username}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  if (!hasTrustedOrigin(request)) {
    logEvent('warn', 'auth.login.untrusted_origin', { correlationId, durationMs: Date.now() - startedAt });
    await recordOperationalMetricSafely({ metric: 'auth.login', outcome: 'untrusted_origin', durationMs: Date.now() - startedAt });
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  const genericError = "ID ou senha incorretos.";
  if (!parsed.success) {
    await recordOperationalMetricSafely({ metric: 'auth.login', outcome: 'invalid_input', durationMs: Date.now() - startedAt });
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  const key = rateLimitKey(request, parsed.data.username);
  const limit = await consumeLoginAttempt(key);
  if (!limit.allowed) {
    logEvent('warn', 'auth.login.rate_limited', { correlationId, retryAfterSeconds: limit.retryAfterSeconds, durationMs: Date.now() - startedAt });
    await recordOperationalMetricSafely({ metric: 'auth.login', outcome: 'rate_limited', durationMs: Date.now() - startedAt });
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : (await consumeComparablePasswordTime(parsed.data.password), false);

  if (!user || !passwordMatches) {
    await db.auditEvent.create({
      data: {
        actorUserId: user?.id,
        action: "session.login",
        objectType: "User",
        objectId: user?.id,
        result: "DENIED",
        correlationId,
      },
    });
    logEvent('warn', 'auth.login.denied', { correlationId, durationMs: Date.now() - startedAt });
    await recordOperationalMetricSafely({ metric: 'auth.login', outcome: 'denied', durationMs: Date.now() - startedAt });
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  await clearLoginAttempts(key);
  await createSession(user.id);
  await db.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "session.login",
      objectType: "User",
      objectId: user.id,
      result: "SUCCESS",
      correlationId,
    },
  });
  logEvent('info', 'auth.login.success', { correlationId, durationMs: Date.now() - startedAt });
  await recordOperationalMetricSafely({ metric: 'auth.login', outcome: 'success', durationMs: Date.now() - startedAt });

  return NextResponse.json({ next: user.onboardingDone ? "/hoje" : "/onboarding" });
}
