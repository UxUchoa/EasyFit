import type { Metadata } from 'next';
import { NotificationPreferences } from '@/components/notification-preferences';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { zonedDateTimeParts } from '@/lib/diary/date';
import { REMINDER_TYPES, type ReminderType } from '@/lib/notifications/schedule';

export const metadata: Metadata = { title: 'Lembretes' };
export const dynamic = 'force-dynamic';

const defaults: Record<ReminderType, { enabled: boolean; timeMinutes: number; weekdays: number[]; channel: 'IN_APP' | 'PUSH' }> = {
  MEAL: { enabled: false, timeMinutes: 12 * 60, weekdays: [0, 1, 2, 3, 4, 5, 6], channel: 'IN_APP' },
  WORKOUT: { enabled: false, timeMinutes: 18 * 60, weekdays: [1, 3, 5], channel: 'IN_APP' },
  CHECK_IN: { enabled: false, timeMinutes: 20 * 60, weekdays: [0], channel: 'IN_APP' },
};

export default async function RemindersPage() {
  const user = await requireUser();
  const [settings, stored] = await Promise.all([
    db.notificationSettings.findUnique({ where: { userId: user.id } }),
    db.notificationPreference.findMany({ where: { userId: user.id } }),
  ]);
  const byType = new Map(stored.map((item) => [item.type, item]));
  const preferences = REMINDER_TYPES.map((type) => {
    const item = byType.get(type);
    return item ? { type, enabled: item.enabled, timeMinutes: item.timeMinutes, weekdays: item.weekdays, channel: item.channel === 'PUSH' ? 'PUSH' as const : 'IN_APP' as const } : { type, ...defaults[type] };
  });
  const timezone = user.profile?.timezone ?? 'America/Sao_Paulo';
  const current = zonedDateTimeParts(new Date(), timezone);
  const weekday = current.weekday;
  const currentMinutes = current.hour * 60 + current.minute;

  return <main className='shell py-8'><p className='eyebrow'>Lembretes</p><h1 className='display mt-2 text-4xl font-bold'>No seu horário, sem pressão.</h1><p className='mt-3 max-w-2xl leading-7 text-[#657168]'>Configure alimentação, treino e check-in separadamente. Nenhum lembrete substitui orientação profissional.</p><NotificationPreferences initialPreferences={preferences} quietStartMinutes={settings?.quietStartMinutes ?? null} quietEndMinutes={settings?.quietEndMinutes ?? null} initialPushPermission={settings?.pushPermission === 'granted' || settings?.pushPermission === 'denied' ? settings.pushPermission : 'default'} currentWeekday={weekday} currentMinutes={currentMinutes} /></main>;
}
