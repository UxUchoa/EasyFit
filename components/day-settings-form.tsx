'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

function timeFromMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function DaySettingsForm({ timezone, dayClosesAtMinutes }: { timezone: string; dayClosesAtMinutes: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(''); setError(false);
    const data = new FormData(event.currentTarget);
    const [hours, minutes] = String(data.get('dayClosesAt')).split(':').map(Number);
    const response = await fetch('/api/profile/day-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timezone: data.get('timezone'), dayClosesAtMinutes: hours * 60 + minutes }) }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
    if (!response?.ok) { setError(true); setMessage(result?.error ?? 'Nao foi possivel salvar.'); }
    else { setMessage('Regra do dia atualizada. Dias historicos nao foram alterados.'); router.refresh(); }
    setPending(false);
  }

  return <form className='mt-5 grid gap-4' onSubmit={submit}>
    <div className='grid gap-4 sm:grid-cols-2'><div className='field'><label htmlFor='profile-timezone'>Fuso horário IANA</label><input id='profile-timezone' name='timezone' list='brazil-timezones' defaultValue={timezone} required /><datalist id='brazil-timezones'><option value='America/Sao_Paulo' /><option value='America/Manaus' /><option value='America/Cuiaba' /><option value='America/Rio_Branco' /><option value='America/Noronha' /></datalist></div><div className='field'><label htmlFor='day-closes-at'>O dia fecha às</label><input id='day-closes-at' name='dayClosesAt' type='time' defaultValue={timeFromMinutes(dayClosesAtMinutes)} required /></div></div>
    <p className='text-xs leading-5 text-[#657168]'>Registros feitos antes desse horário pertencem ao dia lógico anterior. Alterar esta regra só afeta novos resumos; dias já registrados mantêm o fuso salvo neles.</p>
    <p role='status' aria-live='polite' className={`min-h-5 text-sm font-bold ${error ? 'text-[#b42318]' : 'text-[#166534]'}`}>{message}</p>
    <button className='button-primary' disabled={pending}>{pending ? 'Salvando…' : 'Salvar regra do dia'}</button>
  </form>;
}
