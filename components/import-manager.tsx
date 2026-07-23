'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Decision = 'PENDING' | 'KEEP' | 'REPLACE' | 'IGNORE' | 'MANUAL';
type ImportItem = { id: string; position: number; dayLabel: string; mealLabel: string; extractedName: string; extractedQuantity: string | null; extractedUnit: string | null; sourcePointer: string; confidence: number; matchedFoodName: string | null; matchedFoodSource: string | null; matchConfidence: number | null; decision: Decision; reviewedName: string | null; reviewedQuantity: string | null; reviewedUnit: string | null };
type ImportJob = { id: string; status: string; filename: string; byteSize: number; parserVersion: string; attemptCount: number; failureReason: string | null; createdAt: string; reviewReadyAt: string | null; completedAt: string | null; plan: { id: string; name: string; active: boolean } | null; items: ImportItem[] };

const statusLabels: Record<string, string> = { PENDING: 'Pendente', PROCESSING: 'Processando', REVIEW: 'Em revisão', FAILED: 'Falhou', COMPLETED: 'Concluída', CANCELLED: 'Cancelada' };
const decisionLabels: Record<Decision, string> = { PENDING: 'Revisão necessária', KEEP: 'Manter', REPLACE: 'Substituir', IGNORE: 'Ignorar', MANUAL: 'Corrigir manualmente' };
const example = `{
  "name": "Plano semanal",
  "days": [{
    "label": "Segunda-feira",
    "meals": [{
      "name": "Almoço",
      "items": [
        { "food": "Arroz integral", "quantity": 100, "unit": "g" },
        { "food": "Salada a gosto" }
      ]
    }]
  }]
}`;

async function api(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'Não foi possível concluir a operação.');
  return body;
}

export function ImportManager({ jobs }: { jobs: ImportJob[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError(true); setMessage('Escolha um arquivo JSON.'); return; }
    setPending(true); setError(false); setMessage('Validando o arquivo…');
    try {
      const content = await file.text();
      await api('/api/imports', { method: 'POST', body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/json', content }) });
      if (fileRef.current) fileRef.current.value = '';
      setMessage('Arquivo recebido e pronto para revisão.'); router.refresh();
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : 'Falha no envio.'); }
    finally { setPending(false); }
  }

  async function review(event: FormEvent<HTMLFormElement>, jobId: string, itemId: string) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const decision = String(data.get('decision')) as Decision;
    setPending(true); setError(false); setMessage('Salvando revisão…');
    try {
      await api(`/api/imports/${jobId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ decision, name: String(data.get('name') || '') || null, quantity: data.get('quantity') ? Number(data.get('quantity')) : null, unit: String(data.get('unit') || '') || null }) });
      setMessage('Item revisado sem alterar as demais correções.'); router.refresh();
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : 'Falha na revisão.'); }
    finally { setPending(false); }
  }

  async function action(url: string, success: string) {
    setPending(true); setError(false); setMessage('Processando…');
    try { await api(url, { method: 'POST', body: '{}' }); setMessage(success); router.refresh(); }
    catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : 'Falha na operação.'); }
    finally { setPending(false); }
  }

  return <div className='mt-8 space-y-6'>
    <section className='card p-6 sm:p-7'>
      <h2 className='text-2xl font-black'>1. Enviar JSON</h2>
      <form className='mt-5 flex flex-wrap items-end gap-4' onSubmit={upload}>
        <div className='field min-w-64 flex-1'><label htmlFor='diet-import-file'>Arquivo da dieta</label><input ref={fileRef} id='diet-import-file' type='file' accept='.json,application/json' required /></div>
        <button className='button-primary' disabled={pending}>{pending ? 'Aguarde…' : 'Receber arquivo'}</button>
      </form>
      <details className='mt-5 rounded-2xl bg-[#f4f6f1] p-4 text-sm'><summary className='cursor-pointer font-black'>Formato JSON aceito</summary><p className='mt-3 leading-6 text-[#657168]'>Quantidade e unidade podem faltar, mas o item ficará bloqueado para revisão. Campos extras são recusados.</p><pre className='mt-3 overflow-x-auto whitespace-pre rounded-xl bg-[#153d28] p-4 text-xs text-white'>{example}</pre></details>
    </section>
    <p role='status' aria-live='polite' className={'min-h-5 text-sm font-bold ' + (error ? 'text-[#b42318]' : 'text-[#166534]')}>{message}</p>
    <section>
      <h2 className='text-2xl font-black'>2. Histórico e revisão</h2>
      {!jobs.length && <div className='card mt-4 p-6 text-sm text-[#657168]'>Nenhuma importação recebida.</div>}
      <div className='mt-4 space-y-5'>{jobs.map((job) => {
        const ignored = job.items.filter((item) => item.decision === 'IGNORE').length;
        const pendingItems = job.items.filter((item) => item.decision === 'PENDING').length;
        return <article key={job.id} className='card p-6'>
          <div className='flex flex-wrap items-start justify-between gap-3'><div><h3 className='text-xl font-black'>{job.filename}</h3><p className='mt-1 text-sm text-[#657168]'>{new Date(job.createdAt).toLocaleString('pt-BR')} · {(job.byteSize / 1024).toFixed(1)} KB · tentativa {job.attemptCount}</p></div><span className='rounded-full bg-[#e9f6e8] px-3 py-1 text-xs font-black text-[#166534]'>{statusLabels[job.status] ?? job.status}</span></div>
          {job.failureReason && <p className='mt-4 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#8f1d13]'>{job.failureReason}</p>}
          {job.status === 'REVIEW' && <>
            <div className='mt-4 rounded-2xl border border-[#eadc9c] bg-[#fffbed] p-4 text-sm leading-6'><strong>{pendingItems} item(ns) exigem decisão.</strong> Ignorar removerá {ignored} item(ns) do plano final. Reprocessar reinicia as revisões deste job.</div>
            <div className='mt-4 space-y-3'>{job.items.map((item) => <form key={item.id} onSubmit={(event) => review(event, job.id, item.id)} className='rounded-2xl border border-[#dfe5dc] p-4'>
              <div className='flex flex-wrap justify-between gap-2'><div><p className='font-black'>{item.dayLabel} · {item.mealLabel}</p><p className='text-sm text-[#657168]'>{item.extractedName} · {item.extractedQuantity ?? 'quantidade ausente'} {item.extractedUnit ?? ''}</p></div><span className='text-xs font-bold text-[#657168]'>extração {Math.round(item.confidence * 100)}%</span></div>
              <p className='mt-2 text-xs text-[#657168]'>Origem: <code>{item.sourcePointer}</code>{item.matchedFoodName ? ` · Catálogo: ${item.matchedFoodName} (${item.matchedFoodSource}, ${Math.round((item.matchConfidence ?? 0) * 100)}%)` : ' · Sem correspondência segura no catálogo'}</p>
              <div className='mt-4 grid gap-3 sm:grid-cols-4'><div className='field'><label htmlFor={`decision-${item.id}`}>Decisão</label><select id={`decision-${item.id}`} name='decision' defaultValue={item.decision}>{(Object.keys(decisionLabels) as Decision[]).map((decision) => <option key={decision} value={decision}>{decisionLabels[decision]}</option>)}</select></div><div className='field'><label htmlFor={`name-${item.id}`}>Alimento final</label><input id={`name-${item.id}`} name='name' defaultValue={item.reviewedName ?? item.matchedFoodName ?? item.extractedName} /></div><div className='field'><label htmlFor={`quantity-${item.id}`}>Quantidade</label><input id={`quantity-${item.id}`} name='quantity' type='number' min='0.001' step='0.001' defaultValue={item.reviewedQuantity ?? item.extractedQuantity ?? ''} /></div><div className='field'><label htmlFor={`unit-${item.id}`}>Unidade</label><input id={`unit-${item.id}`} name='unit' defaultValue={item.reviewedUnit ?? item.extractedUnit ?? ''} /></div></div>
              <button className='button-secondary mt-3' disabled={pending}>Salvar este item</button>
            </form>)}</div>
            <div className='mt-5 flex flex-wrap gap-3'><button className='button-primary' disabled={pending || pendingItems > 0} onClick={() => action(`/api/imports/${job.id}/confirm`, 'Dieta confirmada e ativada.')}>Confirmar e ativar dieta</button><button className='button-secondary' disabled={pending} onClick={() => action(`/api/imports/${job.id}/retry`, 'Importação reprocessada sem duplicar a dieta.')}>Reprocessar</button><button className='button-secondary' disabled={pending} onClick={() => action(`/api/imports/${job.id}/cancel`, 'Importação cancelada.')}>Cancelar importação</button></div>
          </>}
          {job.status === 'FAILED' && <div className='mt-4 flex flex-wrap gap-3'><button className='button-secondary' disabled={pending} onClick={() => action(`/api/imports/${job.id}/retry`, 'Importação reprocessada.')}>Tentar novamente</button><button className='button-secondary' disabled={pending} onClick={() => action(`/api/imports/${job.id}/cancel`, 'Importação cancelada.')}>Cancelar importação</button></div>}
          {job.status === 'COMPLETED' && job.plan && <p className='mt-4 rounded-2xl bg-[#f2f8f1] p-4 text-sm'><strong>{job.plan.name}</strong> foi confirmado e está {job.plan.active ? 'ativo' : 'arquivado'}.</p>}
          <p className='mt-4 text-xs text-[#657168]'>Parser {job.parserVersion}. O arquivo bruto não é exibido nem gravado em logs.</p>
        </article>;
      })}</div>
    </section>
  </div>;
}
