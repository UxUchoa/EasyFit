import Link from "next/link";
import { Brand } from "@/components/brand";

const features = [
  ["Refeições sem atrito", "Registre o que comeu, compare com o planejado e mantenha cada dia consistente."],
  ["Metas transparentes", "Entenda fórmulas, unidades e estimativas — e ajuste tudo quando precisar."],
  ["Treino que acompanha", "Planeje, inicie e retome séries sem perder o que já foi registrado."],
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-hidden">
      <header className="shell flex items-center justify-between py-6">
        <Brand />
        <Link href="/entrar" className="button-secondary !min-h-11 !px-5">
          Entrar
        </Link>
      </header>

      <section className="shell grid items-center gap-12 pb-20 pt-12 lg:grid-cols-[1.08fr_.92fr] lg:pt-24">
        <div>
          <p className="eyebrow">Seu ritmo, seus dados</p>
          <h1 className="display mt-5 max-w-3xl text-5xl leading-[0.98] font-bold sm:text-7xl">
            Saúde prática, sem transformar a vida em planilha.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#59655d]">
            Alimentação, metas e treino em uma experiência simples, privada e feita para a rotina real.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="button-primary">
              Criar minha conta <span aria-hidden="true">→</span>
            </Link>
            <a href="#como-funciona" className="button-secondary">
              Conhecer o EasyFit
            </a>
          </div>
          <p className="mt-5 text-sm text-[#667269]">
            Sem recuperação de senha no lançamento. Você verá esse aviso novamente antes de criar a conta.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div aria-hidden="true" className="absolute -inset-12 -z-10 rounded-full bg-[#d8f24a]/25 blur-3xl" />
          <div className="card rotate-1 p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#69746c]">Hoje</p>
                <p className="mt-1 text-2xl font-black">Um passo de cada vez.</p>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-[#e8f6e9] text-xl" aria-hidden="true">✓</span>
            </div>
            <div className="mt-7 rounded-2xl bg-[#153d28] p-5 text-white">
              <div className="flex items-end justify-between gap-4">
                <div><span className="text-4xl font-black">1.480</span><span className="ml-2 text-sm text-white/70">kcal</span></div>
                <span className="text-sm text-white/70">de 2.180</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[68%] rounded-full bg-[#d8f24a]" /></div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm"><span>92 g<br /><b>proteína</b></span><span>168 g<br /><b>carbo</b></span><span>48 g<br /><b>gordura</b></span></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e0e6de] p-4"><span className="text-xs font-bold text-[#69746c]">PRÓXIMA REFEIÇÃO</span><p className="mt-2 font-black">Lanche da tarde</p><p className="mt-1 text-sm text-[#69746c]">Planejado · 320 kcal</p></div>
              <div className="rounded-2xl border border-[#e0e6de] p-4"><span className="text-xs font-bold text-[#69746c]">TREINO DE HOJE</span><p className="mt-2 font-black">Membros superiores</p><p className="mt-1 text-sm text-[#69746c]">6 exercícios · 45 min</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-[#dfe5dc] bg-white/70 py-16">
        <div className="shell grid gap-5 md:grid-cols-3">
          {features.map(([title, description], index) => (
            <article key={title} className="rounded-3xl border border-[#e1e6df] bg-white p-6">
              <span className="eyebrow">0{index + 1}</span>
              <h2 className="mt-5 text-xl font-black">{title}</h2>
              <p className="mt-3 leading-7 text-[#637067]">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
