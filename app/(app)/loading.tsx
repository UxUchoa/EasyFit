export default function AppLoading() {
  return <main className='shell py-8' aria-busy='true' aria-live='polite'><p className='eyebrow'>Carregando</p><h1 className='display mt-2 text-4xl font-bold'>Preparando seus dados…</h1><div className='mt-8 grid gap-5 lg:grid-cols-2'><div className='card min-h-64 animate-pulse bg-[#edf1e9]' /><div className='card min-h-64 animate-pulse bg-[#edf1e9]' /></div><span className='sr-only'>Aguarde enquanto o EasyFit carrega a página.</span></main>;
}
