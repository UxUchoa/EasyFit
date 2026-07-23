"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const REVIEW_LABELS: Record<string, string> = { female: 'Feminino', male: 'Masculino', sedentary: 'Sedentário', light: 'Levemente ativo', moderate: 'Moderadamente ativo', very_active: 'Muito ativo', lose: 'Reduzir peso', maintain: 'Manter peso', gain: 'Aumentar peso', beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };
const displayReview = (value: string | undefined) => value ? REVIEW_LABELS[value] ?? value : 'Não informado';

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Record<string, string> | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      const current = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]));
      setReview({ ...(review ?? {}), ...current });
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setPending(true);
    setError("");
    const data = review ?? Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { error?: string; next?: string };
      if (!response.ok || !result.next) {
        setError(result.error ?? "Revise os dados e tente novamente.");
        return;
      }
      router.push(result.next);
      router.refresh();
    } catch {
      setError("Sem conexão. Seus campos continuam aqui; tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <div className="mb-8 flex items-center gap-3" aria-label={`Etapa ${step} de 3`}>
        {[1, 2, 3].map((item) => (
          <span key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-[#166534]" : "bg-[#dfe5dc]"}`} />
        ))}
      </div>

      <fieldset className={step === 1 ? "grid gap-5" : "hidden"} disabled={step !== 1}>
        <legend className="sr-only">Dados corporais</legend>
        <div className="field">
          <label htmlFor="displayName">Como podemos chamar você?</label>
          <input id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={80} required placeholder="Seu nome ou apelido" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="field"><label htmlFor="birthDate">Data de nascimento</label><input id="birthDate" name="birthDate" type="date" autoComplete="bday" required /></div>
          <div className="field"><label htmlFor="biologicalSex">Sexo para o cálculo</label><select id="biologicalSex" name="biologicalSex" required defaultValue=""><option value="" disabled>Selecione</option><option value="female">Feminino</option><option value="male">Masculino</option></select></div>
        </div>
        <p className="-mt-2 text-xs leading-5 text-[#69746c]">Usado somente na fórmula de Mifflin-St Jeor. É um parâmetro de cálculo, não sua identidade de gênero.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="field"><label htmlFor="heightCm">Altura (cm)</label><input id="heightCm" name="heightCm" type="number" inputMode="decimal" min="120" max="230" step="0.1" required /></div>
          <div className="field"><label htmlFor="currentWeightKg">Peso atual (kg)</label><input id="currentWeightKg" name="currentWeightKg" type="number" inputMode="decimal" min="30" max="350" step="0.1" required /></div>
          <div className="field col-span-2 sm:col-span-1"><label htmlFor="desiredWeightKg">Peso desejado (kg)</label><input id="desiredWeightKg" name="desiredWeightKg" type="number" inputMode="decimal" min="30" max="350" step="0.1" required /></div>
        </div>
        <div className="field"><label htmlFor="activityLevel">Nível de atividade no dia a dia</label><select id="activityLevel" name="activityLevel" defaultValue="moderate" required><option value="sedentary">Sedentário</option><option value="light">Levemente ativo</option><option value="moderate">Moderadamente ativo</option><option value="very_active">Muito ativo</option></select></div>
        <input type="hidden" name="timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"} />
      </fieldset>

      <fieldset className={step === 2 ? "grid gap-5" : "hidden"} disabled={step !== 2}>
        <legend className="sr-only">Objetivo e treino</legend>
        <div className="field"><label htmlFor="objective">Objetivo principal</label><select id="objective" name="objective" defaultValue="maintain" required><option value="lose">Reduzir peso</option><option value="maintain">Manter peso</option><option value="gain">Aumentar peso</option></select></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="field"><label htmlFor="trainingExperience">Experiência de treino</label><select id="trainingExperience" name="trainingExperience" defaultValue="beginner" required><option value="beginner">Iniciante</option><option value="intermediate">Intermediário</option><option value="advanced">Avançado</option></select></div>
          <div className="field"><label htmlFor="trainingDaysPerWeek">Dias por semana</label><input id="trainingDaysPerWeek" name="trainingDaysPerWeek" type="number" inputMode="numeric" min="1" max="7" defaultValue="3" required /></div>
        </div>
        <div className="field"><label htmlFor="physicalRestrictions">Restrições físicas informadas (opcional)</label><textarea id="physicalRestrictions" name="physicalRestrictions" rows={4} maxLength={1000} placeholder="Descreva apenas o que considerar relevante para adaptar o treino." /></div>
        <div className="rounded-2xl border border-[#d9e5d8] bg-[#f4f8f2] p-4 text-sm leading-6 text-[#516157]">
          As metas serão uma <strong>estimativa ajustável</strong>. Mostraremos a fórmula, as entradas e as unidades; o EasyFit não oferece diagnóstico ou prescrição médica.
        </div>
      </fieldset>

      {step === 3 && review && <section className='grid gap-4' aria-labelledby='review-title'><div><p className='eyebrow'>Revisão</p><h2 id='review-title' className='mt-2 text-2xl font-black'>Confira antes de concluir</h2><p className='mt-2 text-sm leading-6 text-[#657168]'>Volte para corrigir qualquer informação. As metas poderão ser ajustadas depois no perfil.</p></div><dl className='grid gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-5 sm:grid-cols-2'><div><dt className='text-xs font-bold text-[#657168]'>Nome</dt><dd className='font-black'>{review.displayName}</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Nascimento</dt><dd className='font-black'>{review.birthDate}</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Sexo para cálculo</dt><dd className='font-black'>{displayReview(review.biologicalSex)}</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Altura e peso</dt><dd className='font-black'>{review.heightCm} cm · {review.currentWeightKg} kg → {review.desiredWeightKg} kg</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Atividade</dt><dd className='font-black'>{displayReview(review.activityLevel)}</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Objetivo</dt><dd className='font-black'>{displayReview(review.objective)}</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Treino</dt><dd className='font-black'>{displayReview(review.trainingExperience)} · {review.trainingDaysPerWeek} dias/semana</dd></div><div><dt className='text-xs font-bold text-[#657168]'>Restrições informadas</dt><dd className='font-black'>{displayReview(review.physicalRestrictions)}</dd></div></dl></section>}
      <p aria-live="polite" role="status" className={`mt-5 min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>{error || "Tudo certo"}</p>

      <div className="mt-3 flex gap-3">
        {step > 1 && <button type='button' className='button-secondary flex-1' onClick={() => setStep(step - 1)}>Voltar</button>}
        <button className='button-primary flex-1' disabled={pending}>{pending ? 'Calculando…' : step === 1 ? 'Continuar' : step === 2 ? 'Revisar dados' : 'Concluir perfil'}</button>
      </div>
    </form>
  );
}
