import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { createJsonImport } from '@/lib/imports/service';
import { MAX_IMPORT_BYTES } from '@/lib/imports/domain';
import { hasTrustedOrigin } from '@/lib/security/request';
import { randomUUID } from 'node:crypto';
import { logEvent } from '@/lib/observability/logger';
import { recordOperationalMetricSafely } from '@/lib/observability/metrics';

export const runtime = 'nodejs';

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(1).max(100),
  content: z.string().min(1).max(MAX_IMPORT_BYTES),
}).strict();

export async function POST(request: NextRequest) {
  const startedAt = Date.now(); const correlationId = randomUUID();
  const observe = async (outcome: string, level: 'info' | 'warn' | 'error', errorName?: string) => {
    const durationMs = Date.now() - startedAt;
    logEvent(level, `imports.receive.${outcome}`, { correlationId, durationMs, errorName });
    await recordOperationalMetricSafely({ metric: 'imports.receive', outcome, durationMs, dimension: 'json' });
  };
  if (!hasTrustedOrigin(request)) { await observe('untrusted_origin', 'warn'); return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 }); }
  const session = await getCurrentSession();
  if (!session) { await observe('unauthorized', 'warn'); return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 }); }
  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) { await observe('invalid_input', 'warn'); return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Arquivo inválido.' }, { status: 400 }); }
  try {
    const job = await createJsonImport(session.userId, parsed.data);
    await observe('success', 'info');
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    await observe('failure', 'error', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível receber a importação.' }, { status: 400 });
  }
}
