'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isQuietMinute, reminderState, timeFromMinutes, type ReminderType } from '@/lib/notifications/schedule';

type Preference = { type: ReminderType; enabled: boolean; timeMinutes: number; weekdays: number[]; channel: 'IN_APP' | 'PUSH' };
const labels: Record<ReminderType, { title: string; description: string }> = {
  MEAL: { title: 'Refeição', description: 'Um lembrete neutro para revisar ou registrar sua alimentação.' },
  WORKOUT: { title: 'Treino', description: 'Lembrete do treino planejado, sem pressão ou sequência punitiva.' },
  CHECK_IN: { title: 'Check-in', description: 'Momento opcional para revisar peso, medidas ou como foi o dia.' },
};
const weekdays = [['D', 0], ['S', 1], ['T', 2], ['Q', 3], ['Q', 4], ['S', 5], ['S', 6]] as const;

export function NotificationPreferences({
  initialPreferences,
  quietStartMinutes,
  quietEndMinutes,
  initialPushPermission,
  currentWeekday,
  currentMinutes,
}: {
  initialPreferences: Preference[];
  quietStartMinutes: number | null;
  quietEndMinutes: number | null;
  initialPushPermission: 'default' | 'granted' | 'denied';
  currentWeekday: number;
  currentMinutes: number;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [quietEnabled, setQuietEnabled] = useState(quietStartMinutes !== null && quietEndMinutes !== null);
  const [quietStart, setQuietStart] = useState(timeFromMinutes(quietStartMinutes ?? 22 * 60));
  const [quietEnd, setQuietEnd] = useState(timeFromMinutes(quietEndMinutes ?? 7 * 60));
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(initialPushPermission);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  function update(type: ReminderType, patch: Partial<Preference>) {
    setPreferences((items) => items.map((item) => item.type === type ? { ...item, ...patch } : item));
  }

  function toggleWeekday(type: ReminderType, day: number) {
    const current = preferences.find((item) => item.type === type)!;
    const next = current.weekdays.includes(day) ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day].sort();
    if (next.length) update(type, { weekdays: next });
  }

  function minutes(value: string) {
    const [hours, minute] = value.split(':').map(Number);
    return hours * 60 + minute;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(''); setError(false);
    const response = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quietStartMinutes: quietEnabled ? minutes(quietStart) : null,
        quietEndMinutes: quietEnabled ? minutes(quietEnd) : null,
        preferences,
      }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
    if (!response?.ok) { setError(true); setMessage(result?.error ?? 'Não foi possível salvar os lembretes.'); }
    else { setMessage('Preferências de lembrete atualizadas.'); router.refresh(); }
    setPending(false);
  }

  async function requestPushPermission() {
    if (!('Notification' in window)) { setPermission('unsupported'); return; }
    setPending(true); setMessage(''); setError(false);
    const result = await Notification.requestPermission();
    setPermission(result);
    await fetch('/api/notifications/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pushPermission: result }) }).catch(() => null);
    setMessage(result === 'granted' ? 'Permissão concedida neste navegador.' : result === 'denied' ? 'Permissão negada. Os lembretes continuam disponíveis aqui, sem novos pedidos automáticos.' : 'A permissão não foi alterada.');
    setPending(false);
  }

  const quietNow = isQuietMinute(currentMinutes, quietEnabled ? minutes(quietStart) : null, quietEnabled ? minutes(quietEnd) : null);

  return <div className='mt-8 grid gap-5'>
    <section className='card p-6 sm:p-7' aria-labelledby='in-app-reminders-title'>
      <div className='flex flex-wrap items-start justify-between gap-4'><div><p className='eyebrow'>Centro in-app</p><h2 id='in-app-reminders-title' className='mt-2 text-2xl font-black'>Lembretes de hoje</h2></div>{quietNow && <span className='rounded-full bg-[#fff5cc] px-3 py-2 text-xs font-black text-[#725d00]'>JANELA SILENCIOSA</span>}</div>
      <div className='mt-5 grid gap-3'>{preferences.map((item) => { const state = reminderState(item, currentWeekday, currentMinutes); return <article key={item.type} className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe5dc] p-4'><div><h3 className='font-black'>{labels[item.type].title}</h3><p className='mt-1 text-sm text-[#657168]'>{state === 'inactive' ? 'Não agendado para hoje' : state === 'upcoming' ? 'Agendado para ' + timeFromMinutes(item.timeMinutes) : 'Disponível desde ' + timeFromMinutes(item.timeMinutes)}</p></div><span className={'rounded-full px-3 py-2 text-xs font-black ' + (state === 'due' ? 'bg-[#e8f6e9] text-[#166534]' : 'bg-[#f1f3ef] text-[#657168]')}>{state === 'due' ? 'AGORA' : state === 'upcoming' ? 'EM BREVE' : 'INATIVO'}</span></article>; })}</div>
      <p className='mt-4 text-xs leading-5 text-[#657168]'>A janela silenciosa pausa apenas entregas push. Este centro continua disponível e não usa linguagem punitiva.</p>
    </section>

    <form className='grid gap-5' onSubmit={save}>
      <section className='card p-6 sm:p-7'><p className='eyebrow'>Agenda</p><h2 className='mt-2 text-2xl font-black'>Tipos, horários e dias</h2><div className='mt-5 grid gap-4'>{preferences.map((item) => <fieldset key={item.type} className='rounded-2xl border border-[#dfe5dc] p-4'><legend className='px-2 font-black'>{labels[item.type].title}</legend><p className='text-sm leading-6 text-[#657168]'>{labels[item.type].description}</p><div className='mt-4 grid gap-4 sm:grid-cols-3'><label className='flex items-center gap-3 text-sm font-bold'><input type='checkbox' checked={item.enabled} onChange={(event) => update(item.type, { enabled: event.target.checked })} />Ativado</label><div className='field'><label htmlFor={'reminder-time-' + item.type}>Horário</label><input id={'reminder-time-' + item.type} type='time' value={timeFromMinutes(item.timeMinutes)} onChange={(event) => update(item.type, { timeMinutes: minutes(event.target.value) })} /></div><div className='field'><label htmlFor={'reminder-channel-' + item.type}>Canal</label><select id={'reminder-channel-' + item.type} value={item.channel} onChange={(event) => update(item.type, { channel: event.target.value as 'IN_APP' | 'PUSH' })}><option value='IN_APP'>Somente no EasyFit</option><option value='PUSH'>Push + EasyFit</option></select></div></div><div className='mt-4 flex flex-wrap gap-2' aria-label={'Dias de ' + labels[item.type].title}>{weekdays.map(([label, day]) => <button type='button' key={day} aria-pressed={item.weekdays.includes(day)} className={'grid size-10 place-items-center rounded-full border text-xs font-black ' + (item.weekdays.includes(day) ? 'border-[#166534] bg-[#166534] text-white' : 'border-[#dfe5dc] bg-white')} onClick={() => toggleWeekday(item.type, day)}>{label}</button>)}</div></fieldset>)}</div></section>

      <section className='card p-6 sm:p-7'><p className='eyebrow'>Silêncio e permissão</p><h2 className='mt-2 text-2xl font-black'>Controle de entrega</h2><label className='mt-5 flex items-center gap-3 text-sm font-bold'><input type='checkbox' checked={quietEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} />Ativar janela silenciosa</label>{quietEnabled && <div className='mt-4 grid gap-4 sm:grid-cols-2'><div className='field'><label htmlFor='quiet-start'>Início</label><input id='quiet-start' type='time' value={quietStart} onChange={(event) => setQuietStart(event.target.value)} /></div><div className='field'><label htmlFor='quiet-end'>Fim</label><input id='quiet-end' type='time' value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} /></div></div>}
        <div className='mt-5 rounded-2xl bg-[#f4f6f1] p-4 text-sm leading-6'><p><strong>Permissão neste navegador:</strong> {permission === 'granted' ? 'concedida' : permission === 'denied' ? 'negada' : permission === 'unsupported' ? 'não suportada' : 'ainda não solicitada'}.</p>{permission === 'default' && <button type='button' className='button-secondary mt-3' disabled={pending} onClick={requestPushPermission}>Permitir notificações push</button>}{permission === 'denied' && <p className='mt-2 text-[#657168]'>Não perguntaremos novamente automaticamente. Você pode alterar a permissão nas configurações do navegador; o centro in-app continua funcionando.</p>}{permission === 'unsupported' && <p className='mt-2 text-[#657168]'>Este navegador não oferece a API de notificações. Use os lembretes dentro do EasyFit.</p>}</div>
      </section>
      <p role='status' aria-live='polite' className={'min-h-5 text-sm font-bold ' + (error ? 'text-[#b42318]' : 'text-[#166534]')}>{message}</p>
      <button className='button-primary' disabled={pending}>{pending ? 'Salvando…' : 'Salvar lembretes'}</button>
    </form>
  </div>;
}
