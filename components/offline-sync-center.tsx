'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bodyForLocalConflictResolution, classifySyncResponse, type OfflineConflict } from '@/lib/offline/domain';
import { deleteOfflineMutation, listOfflineMutations, notifyOfflineSyncCompleted, OFFLINE_QUEUE_EVENT, putOfflineMutation, type OfflineMutation } from '@/lib/offline/queue';

async function sendMutation(mutation: OfflineMutation) {
  try {
    const response = await fetch(mutation.url, { method: mutation.method, headers: { 'Content-Type': 'application/json', ...(mutation.idempotencyKey ? { 'Idempotency-Key': mutation.idempotencyKey } : {}) }, body: JSON.stringify(mutation.body) });
    const body = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string; conflict?: OfflineConflict };
    const status = classifySyncResponse(response.status, Boolean(body.conflict));
    if (status === 'COMPLETE') {
      await deleteOfflineMutation(mutation.id);
      notifyOfflineSyncCompleted({ mutation: { url: mutation.url, method: mutation.method, body: mutation.body }, response: body });
      return true;
    }
    await putOfflineMutation({ ...mutation, status, conflict: status === 'CONFLICT' ? body.conflict ?? null : null, error: body.error ?? 'A sincronização não foi concluída.' });
    return false;
  } catch {
    return false;
  }
}

export function OfflineSyncCenter({ userScope }: { userScope: string }) {
  const router = useRouter();
  const [items, setItems] = useState<OfflineMutation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => setItems(await listOfflineMutations(userScope).catch(() => [])), [userScope]);
  const syncAll = useCallback(async () => {
    if (!navigator.onLine) { await load(); return; }
    setBusy(true);
    const queued = await listOfflineMutations(userScope).catch(() => []);
    let completed = 0;
    for (const item of queued.filter((candidate) => candidate.status === 'PENDING')) if (await sendMutation(item)) completed += 1;
    await load(); setBusy(false);
    if (completed) { setNotice(`${completed} alteração(ões) sincronizada(s).`); router.refresh(); }
  }, [load, router, userScope]);

  useEffect(() => {
    const refresh = () => { void load(); };
    const online = () => { void syncAll(); };
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    window.addEventListener('online', online);
    queueMicrotask(() => { if (navigator.onLine) void syncAll(); else void load(); });
    return () => { window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh); window.removeEventListener('online', online); };
  }, [load, syncAll]);

  async function keepServer(item: OfflineMutation) { await deleteOfflineMutation(item.id); setNotice('A versão do servidor foi mantida; a alteração local foi descartada.'); await load(); router.refresh(); }
  async function applyLocal(item: OfflineMutation) {
    if (!item.conflict) return;
    await putOfflineMutation({ ...item, body: bodyForLocalConflictResolution(item.body, item.conflict), status: 'PENDING', conflict: null, error: null });
    setNotice('A versão local foi escolhida. Tentando aplicar sobre a versão atual…'); await syncAll();
  }
  async function retry(item: OfflineMutation) { await putOfflineMutation({ ...item, status: 'PENDING', error: null, conflict: null }); await syncAll(); }
  async function discard(item: OfflineMutation) { await deleteOfflineMutation(item.id); setNotice('Alteração local descartada.'); await load(); }

  if (!items.length && !notice) return null;
  return <section className='shell mt-2' aria-labelledby='offline-sync-title'>
    <div className='rounded-2xl border border-[#eadc9c] bg-[#fffbed] p-4 text-sm text-[#625521]'>
      <div className='flex flex-wrap items-center justify-between gap-3'><div><h2 id='offline-sync-title' className='font-black'>Sincronização local</h2><p className='mt-1'>{items.length} alteração(ões) deste usuário aguardando neste dispositivo.</p></div>{items.some((item) => item.status === 'PENDING') && <button className='button-secondary' disabled={busy} onClick={() => syncAll()}>{busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>}</div>
      <p role='status' aria-live='polite' className='mt-2 min-h-5 font-bold text-[#166534]'>{notice}</p>
      <div className='mt-3 space-y-3'>{items.map((item) => <article key={item.id} className='rounded-xl border border-[#e2d38b] bg-white p-4'>
        <div className='flex flex-wrap justify-between gap-2'><p className='font-black'>{item.label}</p><span className='text-xs font-black'>{item.status === 'PENDING' ? 'PENDENTE' : item.status === 'CONFLICT' ? 'CONFLITO' : item.status === 'AUTH_REQUIRED' ? 'LOGIN NECESSÁRIO' : 'FALHOU'}</span></div>
        {item.status === 'CONFLICT' && item.conflict && <div className='mt-3'><p>Servidor: <strong>{item.conflict.server.quantity}</strong> · Local: <strong>{item.conflict.client.quantity}</strong>. Nada foi sobrescrito.</p><div className='mt-3 flex flex-wrap gap-2'><button className='button-secondary' disabled={busy} onClick={() => keepServer(item)}>Manter servidor</button><button className='button-primary' disabled={busy} onClick={() => applyLocal(item)}>Aplicar versão local</button></div></div>}
        {item.status === 'AUTH_REQUIRED' && <p className='mt-2'>A sessão expirou. <Link className='font-black underline' href='/entrar'>Entre novamente</Link>; a fila continuará neste dispositivo e nesta conta.</p>}
        {item.status === 'FAILED' && <div className='mt-2'><p>{item.error}</p><div className='mt-3 flex gap-2'><button className='button-secondary' disabled={busy} onClick={() => retry(item)}>Tentar novamente</button><button className='button-secondary' disabled={busy} onClick={() => discard(item)}>Descartar local</button></div></div>}
        {item.status === 'PENDING' && <p className='mt-2'>Será enviada com a mesma chave idempotente quando houver conexão.</p>}
      </article>)}</div>
    </div>
  </section>;
}
