"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CatalogExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  instructions: string | null;
};

type PlanExercise = {
  exerciseId: string;
  dayIndex: number;
  position: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  exercise: CatalogExercise;
};

type WorkoutPlan = {
  id: string;
  name: string;
  division: string;
  active: boolean;
  versions: Array<{ version: number; generatedByRuleVersion: string | null; generationInputs: unknown; exercises: PlanExercise[] }>;
};

type WorkoutFocus = "STRENGTH" | "HYPERTROPHY";
type GenerationDivision = "FULL_BODY" | "AB" | "ABC" | "ABCD" | "ABCDE";

type DraftExercise = {
  exerciseId: string;
  name: string;
  dayIndex: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
};

const DIVISION_DAY_LABELS: Record<string, string[]> = {
  AB: ["Superiores", "Inferiores completos"],
  ABC: ["Peito, ombros e tríceps", "Costas, bíceps e antebraços", "Pernas completas"],
  ABCD: ["Peito e tríceps", "Costas e bíceps", "Pernas completas", "Ombros e antebraços"],
  ABCDE: ["Peito", "Costas", "Pernas completas", "Ombros", "Bíceps, tríceps e antebraços"],
};

function workoutDayLabel(division: string, dayIndex: number) {
  if (division === "FULL_BODY") return `Full body · Dia ${dayIndex + 1}`;
  const sector = DIVISION_DAY_LABELS[division]?.[dayIndex];
  const letter = division !== "CUSTOM" ? String.fromCharCode(65 + dayIndex) : `Dia ${dayIndex + 1}`;
  return sector ? `${letter} · ${sector}` : letter;
}

function normalizedSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function focusLabel(focus: WorkoutFocus) {
  return focus === "STRENGTH" ? "Força" : "Hipertrofia";
}

function savedFocus(inputs: unknown) {
  if (!inputs || typeof inputs !== "object" || !("focus" in inputs)) return null;
  const focus = (inputs as { focus?: unknown }).focus;
  return focus === "STRENGTH" || focus === "HYPERTROPHY" ? focusLabel(focus) : null;
}

export function WorkoutPlanner({
  exercises,
  plans,
  activeSession,
  recentSessions,
}: {
  exercises: CatalogExercise[];
  plans: WorkoutPlan[];
  activeSession: { id: string; name: string; startedAt: string | null } | null;
  recentSessions: Array<{ id: string; name: string; completedAt: string | null }>;
}) {
  const router = useRouter();
  const workoutImportRef = useRef<HTMLInputElement>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [division, setDivision] = useState("CUSTOM");
  const [generationDivision, setGenerationDivision] = useState<GenerationDivision>("ABC");
  const [workoutFocus, setWorkoutFocus] = useState<WorkoutFocus>("HYPERTROPHY");
  const [draft, setDraft] = useState<DraftExercise[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState<{ ruleVersion: string; division: GenerationDivision; focus: WorkoutFocus; warnings: string[]; dayLabels: string[] } | null>(null);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [importReview, setImportReview] = useState<{ filename: string; dayLabels: string[] } | null>(null);
  const activePlans = plans.filter((plan) => plan.active);
  const archivedPlans = plans.filter((plan) => !plan.active);
  const filteredExercises = useMemo(() => {
    const query = normalizedSearch(exerciseQuery);
    if (query.length < 2) return [];
    return exercises.filter((exercise) => normalizedSearch(`${exercise.name} ${exercise.muscleGroup} ${exercise.equipment ?? ""}`).includes(query)).slice(0, 12);
  }, [exerciseQuery, exercises]);

  function addExercise(exercise: CatalogExercise) {
    setDraft((current) => [
      ...current,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        dayIndex: 0,
        targetSets: 3,
        targetReps: "8–12",
        restSeconds: 75,
      },
    ]);
  }

  function updateDraft(index: number, update: Partial<DraftExercise>) {
    setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  }

  function editPlan(plan: WorkoutPlan) {
    const version = plan.versions[0];
    setEditingId(plan.id);
    setPlanName(plan.name);
    setDivision(plan.division);
    setDraft(
      (version?.exercises ?? []).map((item) => ({
        exerciseId: item.exerciseId,
        name: item.exercise.name,
        dayIndex: item.dayIndex,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        restSeconds: item.restSeconds,
      })),
    );
    setShowBuilder(true);
    setError("");
    setGeneration(null);
    setImportReview(null);
    setExerciseQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.length) {
      setError("Adicione pelo menos um exercício.");
      return;
    }
    setPending(true);
    setError("");
    const exercisesPayload = draft
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .sort((a, b) => a.dayIndex - b.dayIndex || a.originalIndex - b.originalIndex)
      .map((item, _index, all) => ({
        exerciseId: item.exerciseId,
        dayIndex: item.dayIndex,
        position: all.slice(0, _index).filter((candidate) => candidate.dayIndex === item.dayIndex).length,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        restSeconds: item.restSeconds,
      }));
    const response = await fetch(editingId ? `/api/workout-plans/${editingId}` : "/api/workout-plans", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: planName,
        division,
        generationRuleVersion: generation?.ruleVersion ?? null,
        generationDivision: generation?.division ?? null,
        generationFocus: generation?.focus ?? null,
        exercises: exercisesPayload,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json()) as { error?: string }) : null;
      setError(result?.error ?? "Não foi possível salvar o plano.");
    } else {
      setShowBuilder(false);
      setEditingId(null);
      setPlanName("");
      setDivision("CUSTOM");
      setDraft([]);
      setGeneration(null);
      setImportReview(null);
      setExerciseQuery("");
      router.refresh();
    }
    setPending(false);
  }

  async function generatePlan() {
    setPending(true); setError('');
    const response = await fetch('/api/workout-plans/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division: generationDivision, focus: workoutFocus }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { error?: string; proposal?: { ruleVersion: string; name: string; division: GenerationDivision; focus: WorkoutFocus; warnings: string[]; dayLabels: string[]; exercises: Array<{ id: string; name: string; dayIndex: number; targetSets: number; targetReps: string; restSeconds: number }> } } : null;
    if (!response?.ok || !result?.proposal) {
      setError(result?.error ?? 'Não foi possível gerar uma sugestão.');
    } else {
      setEditingId(null);
      setPlanName(result.proposal.name);
      setDivision(result.proposal.division);
      setGenerationDivision(result.proposal.division);
      setWorkoutFocus(result.proposal.focus);
      setDraft(result.proposal.exercises.map((exercise) => ({ exerciseId: exercise.id, name: exercise.name, dayIndex: exercise.dayIndex, targetSets: exercise.targetSets, targetReps: exercise.targetReps, restSeconds: exercise.restSeconds })));
      setGeneration({ ruleVersion: result.proposal.ruleVersion, division: result.proposal.division, focus: result.proposal.focus, warnings: result.proposal.warnings, dayLabels: result.proposal.dayLabels });
      setImportReview(null);
      setExerciseQuery("");
      setShowBuilder(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPending(false);
  }

  async function importWorkout(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/workout-plans/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type || "application/json", content: await file.text() }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        proposal?: {
          name: string;
          division: string;
          dayLabels: string[];
          exercises: Array<{ exerciseId: string; name: string; dayIndex: number; targetSets: number; targetReps: string; restSeconds: number }>;
        };
      };
      if (!response.ok || !result.proposal) {
        setError(result.error ?? "Não foi possível importar o treino.");
        return;
      }
      setEditingId(null);
      setPlanName(result.proposal.name);
      setDivision(result.proposal.division);
      setDraft(result.proposal.exercises);
      setGeneration(null);
      setExerciseQuery("");
      setImportReview({ filename: file.name, dayLabels: result.proposal.dayLabels });
      setShowBuilder(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Não foi possível ler ou enviar o arquivo JSON.");
    } finally {
      event.currentTarget.value = "";
      setPending(false);
    }
  }

  async function startWorkout(planId: string, dayIndex: number) {
    setPending(true);
    setError("");
    const response = await fetch("/api/workout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, dayIndex }),
    }).catch(() => null);
    const result = response ? ((await response.json()) as { error?: string; sessionId?: string }) : null;
    if (!response?.ok && !result?.sessionId) setError(result?.error ?? "Não foi possível iniciar o treino.");
    else if (result?.sessionId) router.push(`/treino/sessao/${result.sessionId}`);
    setPending(false);
  }

  async function deletePlan(id: string, name: string) {
    if (!window.confirm(`Excluir definitivamente o plano “${name}”? As sessões já registradas continuarão no histórico.`)) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/workout-plans/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      setError(result?.error ?? "Não foi possível excluir o plano.");
    }
    else router.refresh();
    setPending(false);
  }

  return (
    <>
      {activeSession && <section className="mt-8 rounded-[1.75rem] bg-[#153d28] p-6 text-white shadow-xl"><p className="text-xs font-black tracking-[.14em] text-[#d8f24a]">EM ANDAMENTO</p><h2 className="mt-2 text-2xl font-black">{activeSession.name}</h2><p className="mt-2 text-sm text-white/65">As séries já registradas estão salvas.</p><Link className="button-primary mt-5 w-full !bg-[#d8f24a] !text-[#17201b]" href={`/treino/sessao/${activeSession.id}`}>Retomar treino</Link></section>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="button-primary" onClick={() => { setShowBuilder(true); setEditingId(null); setPlanName(""); setDivision("CUSTOM"); setDraft([]); setGeneration(null); setImportReview(null); setExerciseQuery(""); }}>Criar plano manual</button>
        <button className="button-secondary" disabled={pending} onClick={() => workoutImportRef.current?.click()}>{pending ? "Processando…" : "Importar treino em JSON"}</button>
        <input ref={workoutImportRef} className="sr-only" type="file" accept="application/json,.json" onChange={importWorkout} />
      </div>
      <section className="card mt-4 p-5 sm:p-6" aria-labelledby="workout-suggestion-title">
        <div><p className="eyebrow">Sugestão personalizada</p><h2 id="workout-suggestion-title" className="mt-2 text-xl font-black">Escolha a estrutura antes de gerar</h2></div>
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="field"><label htmlFor="generation-division">Divisão do plano</label><select id="generation-division" value={generationDivision} onChange={(event) => setGenerationDivision(event.target.value as GenerationDivision)}><option value="FULL_BODY">Full body</option><option value="AB">AB · Superior/inferior</option><option value="ABC">ABC · Empurrar/puxar/pernas</option><option value="ABCD">ABCD · Quatro setores</option><option value="ABCDE">ABCDE · Cinco setores</option></select></div>
          <div className="field"><label htmlFor="workout-focus">Foco do treino</label><select id="workout-focus" value={workoutFocus} onChange={(event) => setWorkoutFocus(event.target.value as WorkoutFocus)}><option value="HYPERTROPHY">Hipertrofia</option><option value="STRENGTH">Força</option></select></div>
          <button className="button-primary md:min-w-56" disabled={pending} onClick={generatePlan}>{pending ? "Gerando…" : "Gerar sugestão revisável"}</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#657168]">Força usa menos repetições e descansos maiores. Hipertrofia prioriza múltiplas séries e volume. A proposta sempre poderá ser revisada antes de salvar.</p>
      </section>
      <details className="mt-3 rounded-2xl border border-[#dfe5dc] bg-white p-4 text-sm">
        <summary className="cursor-pointer font-black text-[#166534]">Ver formato JSON do treino</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#17201b] p-4 text-xs leading-5 text-white">{`{
  "name": "Treino ABC",
  "division": "ABC",
  "days": [{
    "label": "Peito e tríceps",
    "exercises": [{
      "exercise": "Supino reto",
      "sets": 4,
      "reps": "8-12",
      "restSeconds": 90
    }]
  }]
}`}</pre>
      </details>
      <p className="mt-3 text-xs leading-5 text-[#657168]">Toda sugestão é uma orientação geral e precisa ser revisada por você. Restrições, dor ou condições de saúde exigem avaliação profissional.</p>
      <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>{error || "Tudo certo"}</p>
      {showBuilder && !generation && <div className="field mt-2 max-w-xs"><label htmlFor="plan-division">Divisão do plano</label><select id="plan-division" value={division} onChange={(event) => setDivision(event.target.value)}><option value="FULL_BODY">Full body</option><option value="A">A</option><option value="AB">AB</option><option value="ABC">ABC</option><option value="ABCD">ABCD</option><option value="ABCDE">ABCDE</option><option value="CUSTOM">Personalizada</option></select></div>}
      {showBuilder && generation && <section className='mt-4 rounded-2xl border border-[#d9e5b5] bg-[#f8fce9] p-5' aria-labelledby='generation-review-title'><p className='eyebrow'>Regra {generation.ruleVersion} · {focusLabel(generation.focus)}</p><h2 id='generation-review-title' className='mt-2 text-xl font-black'>Revisão obrigatória antes de ativar</h2><div className='mt-3 flex flex-wrap gap-2'>{generation.dayLabels.map((label, index) => <span key={`${label}-${index}`} className='rounded-full bg-white px-3 py-2 text-xs font-black text-[#166534]'>{generation.division === 'FULL_BODY' ? 'Full body' : String.fromCharCode(65 + index)} · {label}</span>)}</div><ul className='mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#657168]'>{generation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><p className='mt-3 text-sm font-bold text-[#166534]'>Altere nome, dias, exercícios, séries, repetições ou descanso abaixo. O plano só será ativado ao pressionar “Salvar plano”.</p></section>}

      {showBuilder && (
        <section className="card mt-4 p-5 sm:p-7" aria-labelledby="builder-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{importReview ? "Importação JSON" : editingId ? "Nova versão" : generation ? "Sugestão gerada" : "Plano manual"}</p>
              <h2 id="builder-title" className="mt-2 text-2xl font-black">Monte seus dias de treino</h2>
            </div>
            <button type="button" className="grid size-11 place-items-center rounded-full border border-[#dfe5dc] bg-white text-xl" onClick={() => setShowBuilder(false)} aria-label="Fechar">×</button>
          </div>
      
          {importReview && (
            <section className="mt-5 rounded-2xl border border-[#d9e5b5] bg-[#f8fce9] p-4" aria-label="Revisão da importação">
              <p className="font-black text-[#166534]">Arquivo validado: {importReview.filename}</p>
              <p className="mt-2 text-sm leading-6 text-[#657168]">Revise todos os exercícios, dias, séries, repetições e descansos. O plano só será criado quando você tocar em “Salvar plano”.</p>
              <div className="mt-3 flex flex-wrap gap-2">{importReview.dayLabels.map((label, index) => <span key={`${label}-${index}`} className="rounded-full bg-white px-3 py-2 text-xs font-black">{index + 1} · {label}</span>)}</div>
            </section>
          )}
      
          <form onSubmit={submitPlan} className="mt-6 grid gap-5">
            <div className="field">
              <label htmlFor="plan-name">Nome do plano</label>
              <input id="plan-name" value={planName} onChange={(event) => setPlanName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Treino da semana" />
            </div>
      
            <div>
              <div className="field">
                <label htmlFor="exercise-search">Pesquisar exercício</label>
                <input id="exercise-search" type="search" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="Ex.: supino, costas, halteres…" autoComplete="off" />
              </div>
              {exerciseQuery.trim().length < 2 && <p className="mt-2 text-xs leading-5 text-[#657168]">Digite pelo menos 2 caracteres para procurar por nome, grupo muscular ou equipamento.</p>}
              {exerciseQuery.trim().length >= 2 && (
                <div className="mt-3 grid gap-2" aria-live="polite">
                  {filteredExercises.map((exercise) => (
                    <button key={exercise.id} type="button" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[#dfe5dc] bg-white px-4 py-3 text-left hover:border-[#166534]" onClick={() => addExercise(exercise)}>
                      <span><strong className="block">{exercise.name}</strong><small className="mt-1 block text-[#657168]">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</small></span>
                      <span className="shrink-0 text-xl font-black text-[#166534]" aria-hidden="true">+</span>
                    </button>
                  ))}
                  {filteredExercises.length === 0 && <p className="rounded-2xl bg-[#f4f6f1] p-4 text-sm text-[#657168]">Nenhum exercício encontrado. Tente outro termo.</p>}
                </div>
              )}
            </div>
      
            {draft.length > 0 && (
              <div className="grid gap-3">
                <p className="text-sm font-black">Seu plano · {draft.length} {draft.length === 1 ? "exercício" : "exercícios"}</p>
                {draft.map((item, index) => (
                  <div key={`${item.exerciseId}-${index}`} className="rounded-2xl border border-[#dfe5dc] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black">{item.name}</h3>
                      <button type="button" className="text-xs font-bold text-[#b42318]" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="field"><label htmlFor={`day-${index}`}>Dia</label><input id={`day-${index}`} type="number" min="1" max="7" value={item.dayIndex + 1} onChange={(event) => updateDraft(index, { dayIndex: Number(event.target.value) - 1 })} /></div>
                      <div className="field"><label htmlFor={`sets-${index}`}>Séries</label><input id={`sets-${index}`} type="number" min="1" max="12" value={item.targetSets} onChange={(event) => updateDraft(index, { targetSets: Number(event.target.value) })} /></div>
                      <div className="field"><label htmlFor={`reps-${index}`}>Repetições</label><input id={`reps-${index}`} value={item.targetReps} maxLength={40} onChange={(event) => updateDraft(index, { targetReps: event.target.value })} /></div>
                      <div className="field"><label htmlFor={`rest-${index}`}>Descanso (s)</label><input id={`rest-${index}`} type="number" min="15" max="900" step="5" value={item.restSeconds} onChange={(event) => updateDraft(index, { restSeconds: Number(event.target.value) })} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      
            <button className="button-primary" disabled={pending}>{pending ? "Salvando…" : editingId ? "Criar nova versão" : "Salvar plano"}</button>
          </form>
        </section>
      )}

      <section className="mt-10" aria-labelledby="plans-title"><p className="eyebrow">Planos ativos</p><h2 id="plans-title" className="mt-2 text-2xl font-black">Escolha o treino de hoje</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{activePlans.map((plan) => { const version = plan.versions[0]; const days = [...new Set((version?.exercises ?? []).map((item) => item.dayIndex))]; return <article key={plan.id} className="card p-6"><div className="flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-[#eef4e9] px-3 py-1 text-xs font-black text-[#166534]">{plan.division === "FULL_BODY" ? "Full body" : `Divisão ${plan.division}`}</span>{savedFocus(version?.generationInputs) && <span className="ml-2 inline-flex rounded-full bg-[#f4f6f1] px-3 py-1 text-xs font-black text-[#52604e]">{savedFocus(version?.generationInputs)}</span>}<h3 className="mt-2 text-xl font-black">{plan.name}</h3><p className="mt-1 text-sm text-[#657168]">Versão {version?.version ?? 1} · {days.length} {days.length === 1 ? "dia" : "dias"}</p>{version?.generatedByRuleVersion && <p className="mt-2 text-xs font-bold text-[#725d00]">Sugestão gerada pela regra {version.generatedByRuleVersion} e confirmada após revisão.</p>}</div><button className="rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" onClick={() => editPlan(plan)}>Editar</button></div><div className="mt-5 grid gap-2">{days.map((dayIndex) => { const count = version?.exercises.filter((item) => item.dayIndex === dayIndex).length ?? 0; return <button key={dayIndex} data-testid={`workout-day-${dayIndex}`} className="button-secondary w-full !justify-between" disabled={pending || Boolean(activeSession)} onClick={() => startWorkout(plan.id, dayIndex)}><span>{workoutDayLabel(plan.division, dayIndex)} · {count} exercícios</span><span aria-hidden="true">→</span></button>; })}</div><button className="mt-4 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => deletePlan(plan.id, plan.name)}>Excluir plano</button></article>; })}{activePlans.length === 0 && <div className="card p-7 lg:col-span-2"><h3 className="text-xl font-black">Nenhum plano ativo</h3><p className="mt-3 text-[#657168]">Crie um plano manual ou gere uma sugestão revisável para começar.</p></div>}</div></section>

      {archivedPlans.length > 0 && <section className="mt-10" aria-labelledby="archived-plans-title"><p className="eyebrow">Planos arquivados</p><h2 id="archived-plans-title" className="mt-2 text-2xl font-black">Limpe planos antigos</h2><div className="mt-4 grid gap-3">{archivedPlans.map((plan) => <article key={plan.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#dfe5dc] bg-white p-5"><div><h3 className="font-black">{plan.name}</h3><p className="mt-1 text-xs text-[#657168]">{plan.division === "FULL_BODY" ? "Full body" : `Divisão ${plan.division}`}</p></div><button className="rounded-full border border-[#fecaca] px-3 py-2 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => deletePlan(plan.id, plan.name)}>Excluir definitivamente</button></article>)}</div></section>}

      {recentSessions.length > 0 && <section className="mt-10"><p className="eyebrow">Histórico recente</p><h2 className="mt-2 text-2xl font-black">Treinos concluídos</h2><div className="mt-4 grid gap-3">{recentSessions.map((session) => <Link key={session.id} href={`/treino/sessao/${session.id}`} className="flex items-center justify-between rounded-2xl border border-[#dfe5dc] bg-white p-5 text-inherit no-underline"><span><b>{session.name}</b><br /><small className="text-[#657168]">{session.completedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.completedAt)) : "Concluído"}</small></span><span aria-hidden="true">→</span></Link>)}</div></section>}
    </>
  );
}
