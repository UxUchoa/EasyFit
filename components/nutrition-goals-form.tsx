"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  birthDate: string; biologicalSex: string; heightCm: number; currentWeightKg: number; desiredWeightKg: number; activityLevel: string; objective: string;
  goal: { mode: "AUTOMATIC" | "MANUAL"; calorieTarget: number; proteinGrams: number; carbohydrateGrams: number; fatGrams: number };
  estimates: { age: number; bmi: number; bmr: number; tdee: number };
};

export function NutritionGoalsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [tab, setTab] = useState<"AUTOMATIC" | "MANUAL">(initial.goal.mode);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const initialMacroCalories = initial.goal.proteinGrams * 4 + initial.goal.carbohydrateGrams * 4 + initial.goal.fatGrams * 9;
  const [manualUnit, setManualUnit] = useState<'grams' | 'percent'>('grams');
  const [manualCalories, setManualCalories] = useState(initial.goal.calorieTarget);
  const [manualProtein, setManualProtein] = useState(initial.goal.proteinGrams);
  const [manualCarbs, setManualCarbs] = useState(initial.goal.carbohydrateGrams);
  const [manualFat, setManualFat] = useState(initial.goal.fatGrams);
  const [proteinPercent, setProteinPercent] = useState(Math.round(initial.goal.proteinGrams * 4000 / Math.max(1, initialMacroCalories)) / 10);
  const [carbsPercent, setCarbsPercent] = useState(Math.round(initial.goal.carbohydrateGrams * 4000 / Math.max(1, initialMacroCalories)) / 10);
  const [fatPercent, setFatPercent] = useState(Math.round(initial.goal.fatGrams * 9000 / Math.max(1, initialMacroCalories)) / 10);
  const macroCalories = manualProtein * 4 + manualCarbs * 4 + manualFat * 9;
  const percentTotal = proteinPercent + carbsPercent + fatPercent;

  function syncManual(event: FormEvent<HTMLFormElement>) {
    if (tab !== 'MANUAL') return;
    const data = new FormData(event.currentTarget);
    setManualCalories(Number(data.get('calorieTarget') ?? 0));
    if (manualUnit !== 'grams') return;
    setManualProtein(Number(data.get('proteinGrams') ?? 0));
    setManualCarbs(Number(data.get('carbohydrateGrams') ?? 0));
    setManualFat(Number(data.get('fatGrams') ?? 0));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); setError(false);
    const data: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget));
    if (tab === 'MANUAL') {
      data.calorieTarget = manualCalories;
      data.proteinGrams = manualUnit === 'grams' ? manualProtein : manualCalories * proteinPercent / 400;
      data.carbohydrateGrams = manualUnit === 'grams' ? manualCarbs : manualCalories * carbsPercent / 400;
      data.fatGrams = manualUnit === 'grams' ? manualFat : manualCalories * fatPercent / 900;
    }
    const response = await fetch("/api/profile/nutrition", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, mode: tab }) }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
    if (!response?.ok) { setError(true); setMessage(result?.error ?? "Não foi possível atualizar as metas."); }
    else { setMessage("Nova versão das metas criada. Seu histórico anterior foi preservado."); router.refresh(); }
    setPending(false);
  }

  return <section className="card mt-5 p-6 sm:p-7">
    <p className="eyebrow">Metas nutricionais</p><h2 className="mt-2 text-2xl font-black">Estimativa ajustável</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#657168]">Escolha o cálculo transparente ou informe metas manuais. Cada alteração cria uma nova versão válida a partir de agora.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-[#f4f6f1] p-4"><b>{initial.estimates.bmi.toFixed(1)}</b><br/><span className="text-xs text-[#657168]">IMC atual</span></div><div className="rounded-2xl bg-[#f4f6f1] p-4"><b>{initial.estimates.bmr} kcal</b><br/><span className="text-xs text-[#657168]">TMB estimada</span></div><div className="rounded-2xl bg-[#f4f6f1] p-4"><b>{initial.estimates.tdee} kcal</b><br/><span className="text-xs text-[#657168]">Gasto diário estimado</span></div><div className="rounded-2xl bg-[#f4f6f1] p-4"><b>{initial.goal.calorieTarget} kcal</b><br/><span className="text-xs text-[#657168]">Meta vigente</span></div></div>
    <details className="mt-4 rounded-2xl border border-[#dfe5dc] p-4 text-sm leading-6"><summary className="cursor-pointer font-black">Como o cálculo funciona</summary><div className="mt-3 text-[#657168]"><p>TMB pela fórmula de Mifflin–St Jeor: 10 × peso (kg) + 6,25 × altura (cm) − 5 × idade ({initial.estimates.age}) + constante por sexo de cálculo.</p><p className="mt-2">O gasto diário multiplica a TMB pelo fator de atividade: 1,2 sedentário; 1,375 leve; 1,55 moderado; 1,725 muito ativo. A meta usa 85% para redução, 100% para manutenção ou 110% para aumento.</p><p className="mt-2">Macros automáticos: proteína 1,6 g/kg, gordura 0,8 g/kg e o restante das calorias em carboidratos. São estimativas, não diagnóstico ou prescrição médica.</p></div></details>
    <div className="mt-5 grid grid-cols-2 gap-2" role="tablist" aria-label="Modo das metas"><button type="button" className={tab === "AUTOMATIC" ? "button-primary" : "button-secondary"} onClick={() => setTab("AUTOMATIC")}>Automático</button><button type="button" className={tab === "MANUAL" ? "button-primary" : "button-secondary"} onClick={() => setTab("MANUAL")}>Manual</button></div>
    <form className="mt-5 grid gap-4" onSubmit={submit} onInput={syncManual}>
      {tab === "AUTOMATIC" ? <><div className="grid gap-4 sm:grid-cols-3"><div className="field"><label htmlFor="nutrition-birth">Nascimento</label><input id="nutrition-birth" name="birthDate" type="date" defaultValue={initial.birthDate} required /></div><div className="field"><label htmlFor="nutrition-sex">Sexo para cálculo</label><select id="nutrition-sex" name="biologicalSex" defaultValue={initial.biologicalSex}><option value="female">Feminino</option><option value="male">Masculino</option></select></div><div className="field"><label htmlFor="nutrition-height">Altura (cm)</label><input id="nutrition-height" name="heightCm" type="number" min="120" max="230" step="0.1" defaultValue={initial.heightCm} required /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="field"><label htmlFor="nutrition-current-weight">Peso atual (kg)</label><input id="nutrition-current-weight" name="currentWeightKg" type="number" min="30" max="350" step="0.1" defaultValue={initial.currentWeightKg} required /></div><div className="field"><label htmlFor="nutrition-desired-weight">Peso desejado (kg)</label><input id="nutrition-desired-weight" name="desiredWeightKg" type="number" min="30" max="350" step="0.1" defaultValue={initial.desiredWeightKg} required /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="field"><label htmlFor="nutrition-activity">Atividade diária</label><select id="nutrition-activity" name="activityLevel" defaultValue={initial.activityLevel}><option value="sedentary">Sedentário</option><option value="light">Levemente ativo</option><option value="moderate">Moderadamente ativo</option><option value="very_active">Muito ativo</option></select></div><div className="field"><label htmlFor="nutrition-objective">Objetivo</label><select id="nutrition-objective" name="objective" defaultValue={initial.objective}><option value="lose">Reduzir peso</option><option value="maintain">Manter peso</option><option value="gain">Aumentar peso</option></select></div></div></> : <><div className="field"><label htmlFor="manual-calories">Calorias por dia</label><input id="manual-calories" name="calorieTarget" type="number" min="800" max="10000" defaultValue={initial.goal.calorieTarget} required /></div><div className="grid grid-cols-3 gap-3"><div className="field"><label htmlFor="manual-protein">Proteína (g)</label><input id="manual-protein" name="proteinGrams" type="number" min="0" max="1000" step="0.1" defaultValue={initial.goal.proteinGrams} required /></div><div className="field"><label htmlFor="manual-carbs">Carbo (g)</label><input id="manual-carbs" name="carbohydrateGrams" type="number" min="0" max="2000" step="0.1" defaultValue={initial.goal.carbohydrateGrams} required /></div><div className="field"><label htmlFor="manual-fat">Gordura (g)</label><input id="manual-fat" name="fatGrams" type="number" min="0" max="1000" step="0.1" defaultValue={initial.goal.fatGrams} required /></div></div><p className="text-xs leading-5 text-[#657168]">As calorias informadas não precisam coincidir com a soma dos macros; o EasyFit manterá exatamente os valores escolhidos.</p></>}
      {tab === 'MANUAL' && <div className='rounded-2xl border border-[#dfe5dc] p-4'><div className='grid grid-cols-2 gap-2'><button type='button' className={manualUnit === 'grams' ? 'button-primary' : 'button-secondary'} onClick={() => setManualUnit('grams')}>Usar gramas</button><button type='button' className={manualUnit === 'percent' ? 'button-primary' : 'button-secondary'} onClick={() => setManualUnit('percent')}>Usar percentuais</button></div>{manualUnit === 'grams' ? <p className='mt-3 text-sm leading-6 text-[#657168]'>Energia dos macros: <strong>{Math.round(macroCalories)} kcal</strong>. Diferença para a meta: <strong>{Math.round(macroCalories - manualCalories)} kcal</strong>. Proteína {macroCalories ? Math.round(manualProtein * 4000 / macroCalories) / 10 : 0}%, carboidratos {macroCalories ? Math.round(manualCarbs * 4000 / macroCalories) / 10 : 0}% e gordura {macroCalories ? Math.round(manualFat * 9000 / macroCalories) / 10 : 0}%.</p> : <div className='mt-4'><div className='grid grid-cols-3 gap-3'><div className='field'><label htmlFor='protein-percent'>Proteína (%)</label><input id='protein-percent' type='number' min='0' max='100' step='0.1' value={proteinPercent} onChange={(event) => setProteinPercent(Number(event.target.value))} /></div><div className='field'><label htmlFor='carbs-percent'>Carbo (%)</label><input id='carbs-percent' type='number' min='0' max='100' step='0.1' value={carbsPercent} onChange={(event) => setCarbsPercent(Number(event.target.value))} /></div><div className='field'><label htmlFor='fat-percent'>Gordura (%)</label><input id='fat-percent' type='number' min='0' max='100' step='0.1' value={fatPercent} onChange={(event) => setFatPercent(Number(event.target.value))} /></div></div><p className={`mt-3 text-sm font-bold ${Math.abs(percentTotal - 100) > 0.1 ? 'text-[#b42318]' : 'text-[#166534]'}`}>Total: {percentTotal.toFixed(1)}%. A conversão usa {manualCalories} kcal e será salva em gramas.</p></div>}</div>}
      <p role='status' aria-live='polite' className={`min-h-5 text-sm font-bold ${error ? 'text-[#b42318]' : 'text-[#166534]'}`}>{message}</p><button className='button-primary' disabled={pending || (tab === 'MANUAL' && manualUnit === 'percent' && Math.abs(percentTotal - 100) > 0.1)}>{pending ? 'Salvando…' : 'Criar nova versão das metas'}</button>
    </form>
  </section>;
}
