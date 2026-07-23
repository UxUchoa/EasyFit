import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { REMINDER_TYPES } from '@/lib/notifications/schedule';
import { hasTrustedOrigin } from '@/lib/security/request';

export const runtime = 'nodejs';

const preferenceSchema = z.object({
  type: z.enum(REMINDER_TYPES),
  enabled: z.boolean(),
  timeMinutes: z.coerce.number().int().min(0).max(1439),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).transform((values) => [...new Set(values)].sort()),
  channel: z.enum(['IN_APP', 'PUSH']),
});
const settingsSchema = z.object({
  quietStartMinutes: z.coerce.number().int().min(0).max(1439).nullable(),
  quietEndMinutes: z.coerce.number().int().min(0).max(1439).nullable(),
  preferences: z.array(preferenceSchema).length(3).refine((items) => new Set(items.map((item) => item.type)).size === REMINDER_TYPES.length, 'Informe cada tipo de lembrete uma vez.'),
});
const permissionSchema = z.object({ pushPermission: z.enum(['default', 'granted', 'denied']) });

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const [settings, preferences] = await Promise.all([
    db.notificationSettings.findUnique({ where: { userId: session.userId } }),
    db.notificationPreference.findMany({ where: { userId: session.userId }, orderBy: { type: 'asc' } }),
  ]);
  return NextResponse.json({ settings, preferences });
}

export async function PUT(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Preferências inválidas.' }, { status: 400 });
  await db.$transaction(async (transaction) => {
    await transaction.notificationSettings.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, quietStartMinutes: parsed.data.quietStartMinutes, quietEndMinutes: parsed.data.quietEndMinutes },
      update: { quietStartMinutes: parsed.data.quietStartMinutes, quietEndMinutes: parsed.data.quietEndMinutes },
    });
    for (const preference of parsed.data.preferences) {
      await transaction.notificationPreference.upsert({
        where: { userId_type: { userId: session.userId, type: preference.type } },
        create: { userId: session.userId, ...preference },
        update: preference,
      });
    }
    await transaction.auditEvent.create({ data: { actorUserId: session.userId, action: 'notification.preferences.update', objectType: 'NotificationSettings', objectId: session.userId, result: 'SUCCESS', correlationId: randomUUID(), context: { enabledTypes: parsed.data.preferences.filter((item) => item.enabled).map((item) => item.type), quietHoursEnabled: parsed.data.quietStartMinutes !== null } } });
  });
  return NextResponse.json({ updated: true });
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'Solicitação não autorizada.' }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const parsed = permissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Estado de permissão inválido.' }, { status: 400 });
  await db.notificationSettings.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, pushPermission: parsed.data.pushPermission },
    update: { pushPermission: parsed.data.pushPermission },
  });
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: 'notification.permission.update', objectType: 'NotificationSettings', objectId: session.userId, result: 'SUCCESS', correlationId: randomUUID(), context: { permission: parsed.data.pushPermission } } });
  return NextResponse.json({ pushPermission: parsed.data.pushPermission });
}
