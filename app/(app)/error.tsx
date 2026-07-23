'use client';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className='shell py-8'><section className='card mx-auto max-w-2xl p-7'><p className='eyebrow'>Não foi possível carregar</p><h1 className='mt-2 text-3xl font-black'>Seus dados continuam preservados.</h1><p className='mt-3 leading-7 text-[#657168]'>Confira a conexão e tente novamente. Se o problema continuar, volte à tela anterior e repita a ação.</p><button className='button-primary mt-6' onClick={reset}>Tentar novamente</button></section></main>;
}
