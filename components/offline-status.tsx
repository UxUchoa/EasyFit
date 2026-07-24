'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
}

export function OfflineStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <aside role='status' className='mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadc9c] bg-[#fffbed] p-4 text-sm leading-6 text-[#625521]'><span><strong>Você está offline.</strong> Dados já exibidos continuam visíveis; rascunhos e alterações compatíveis ficam neste dispositivo. Ao reconectar, conflitos exigirão sua escolha e nunca serão sobrescritos em silêncio.</span><Link className='rounded-full border border-[#c9b45f] bg-white px-4 py-2 font-black' href='/registro'>Continuar no registro</Link></aside>;
}
