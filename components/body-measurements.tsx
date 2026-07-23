'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Measurement = {
  id: string;
  measuredAt: string;
  weightKg: number;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
};

const fields = [
  ['waistCm', 'Cintura (cm)'],
  ['hipCm', 'Quadril (cm)'],
  ['chestCm', 'Peito (cm)'],
  ['armCm', 'Braço (cm)'],
  ['thighCm', 'Coxa (cm)'],
] as const;

function displayDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value + 'T12:00:00.000Z'));
}

export function BodyMeasurements({ measurements, defaultDate, defaultWeight }: { measurements: Measurement[]; defaultDate: string; defaultWeight: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage(''); setError(false);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(editing ? '/api/measurements/' + editing.id : '/api/measurements', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
    if (!response?.ok) {
      setError(true);
      setMessage(result?.error ?? 'Não foi possível salvar a medição.');
    } else {
      setMessage(editing ? 'Medição atualizada.' : 'Medição registrada.');
      setEditing(null);
      router.refresh();
    }
    setPending(false);
  }

  async function remove(id: string) {
    setPending(true); setMessage(''); setError(false);
    const response = await fetch('/api/measurements/' + id, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
      setError(true); setMessage(result?.error ?? 'Não foi possível excluir.');
    } else {
      setMessage('Medição excluída.');
      setConfirmDelete('');
      if (editing?.id === id) setEditing(null);
      router.refresh();
    }
    setPending(false);
  }

  return <section className='card mt-5 p-6 sm:p-7'>
    <p className='eyebrow'>Evolução corporal</p>
    <h2 className='mt-2 text-2xl font-black'>Peso e medidas</h2>
    <p className='mt-2 max-w-2xl text-sm leading-6 text-[#657168]'>Registre valores com data e unidade. Eles são indicadores de acompanhamento, não diagnóstico.</p>
    <form key={editing?.id ?? 'new'} className='mt-5 grid gap-4' onSubmit={submit}>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='field'><label htmlFor='measurement-date'>Data</label><input id='measurement-date' name='measuredAt' type='date' defaultValue={editing?.measuredAt ?? defaultDate} required /></div>
        <div className='field'><label htmlFor='measurement-weight'>Peso (kg)</label><input id='measurement-weight' name='weightKg' type='number' inputMode='decimal' min='30' max='350' step='0.01' defaultValue={editing?.weightKg ?? defaultWeight} required /></div>
      </div>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-5'>
        {fields.map(([name, label]) => <div className='field' key={name}><label htmlFor={'measurement-' + name}>{label}</label><input id={'measurement-' + name} name={name} type='number' inputMode='decimal' min='10' max='300' step='0.01' defaultValue={editing?.[name] ?? ''} /></div>)}
      </div>
      <p role='status' aria-live='polite' className={'min-h-5 text-sm font-bold ' + (error ? 'text-[#b42318]' : 'text-[#166534]')}>{message}</p>
      <div className='flex flex-wrap gap-3'><button className='button-primary' disabled={pending}>{pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar medição'}</button>{editing && <button type='button' className='button-secondary' onClick={() => setEditing(null)}>Cancelar edição</button>}</div>
    </form>
    <div className='mt-7 overflow-x-auto'>
      <table className='w-full min-w-[42rem] text-left text-sm'>
        <caption className='sr-only'>Histórico de peso e medidas corporais</caption>
        <thead><tr className='border-b border-[#dfe5dc] text-xs text-[#657168]'><th className='py-3'>Data</th><th>Peso</th><th>Cintura</th><th>Quadril</th><th>Peito</th><th>Braço</th><th>Coxa</th><th>Ações</th></tr></thead>
        <tbody>{measurements.map((item) => <tr key={item.id} className='border-b border-[#edf0eb]'><td className='py-3 font-bold'>{displayDate(item.measuredAt)}</td><td>{item.weightKg} kg</td><td>{item.waistCm === null ? '—' : item.waistCm + ' cm'}</td><td>{item.hipCm === null ? '—' : item.hipCm + ' cm'}</td><td>{item.chestCm === null ? '—' : item.chestCm + ' cm'}</td><td>{item.armCm === null ? '—' : item.armCm + ' cm'}</td><td>{item.thighCm === null ? '—' : item.thighCm + ' cm'}</td><td><div className='flex gap-2'><button className='rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold' onClick={() => setEditing(item)}>Editar</button>{confirmDelete === item.id ? <><button className='rounded-full border border-[#f0d5d2] px-3 py-2 text-xs font-bold text-[#b42318]' disabled={pending} onClick={() => remove(item.id)}>Confirmar</button><button className='rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold' onClick={() => setConfirmDelete('')}>Voltar</button></> : <button className='rounded-full border border-[#f0d5d2] px-3 py-2 text-xs font-bold text-[#b42318]' onClick={() => setConfirmDelete(item.id)}>Excluir</button>}</div></td></tr>)}</tbody>
      </table>
      {!measurements.length && <p className='py-6 text-sm text-[#657168]'>Nenhuma medição registrada.</p>}
    </div>
  </section>;
}
