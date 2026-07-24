"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  draftId: string;
  exerciseId: string;
  name: string;
  dayIndex: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
};

function createDraftId() {
  return crypto.randomUUID();
}

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

function generationDivisionLabel(division: GenerationDivision) {
  return division === "FULL_BODY" ? "Full body" : `Treino ${division}`;
}

function savedFocus(inputs: unknown) {
  if (!inputs || typeof inputs !== "object" || !("focus" in inputs)) return null;
  const focus = (inputs as { focus?: unknown }).focus;
  return focus === "STRENGTH" || focus === "HYPERTROPHY" ? focusLabel(focus) : null;
}

function SortableDraftExercise({
  item,
  index,
  positionInDay,
  totalInDay,
  update,
  remove,
  move,
}: {
  item: DraftExercise;
  index: number;
  positionInDay: number;
  totalInDay: number;
  update: (index: number, update: Partial<DraftExercise>) => void;
  remove: (draftId: string) => void;
  move: (draftId: string, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.draftId });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`min-w-0 max-w-full rounded-2xl border bg-white p-3 sm:p-4 ${isDragging ? "border-[#166534] opacity-80 shadow-xl" : "border-[#dfe5dc]"}`}
      data-testid={`draft-exercise-${item.draftId}`}
    >
      <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${item.name} para reordenar`}
          className="flex size-11 touch-none cursor-grab items-center justify-center rounded-xl border border-[#dfe5dc] bg-[#f4f6f1] text-xl font-black text-[#52604e] active:cursor-grabbing"
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 pt-1">
            <p className="text-xs font-bold text-[#657168]">Exercício {positionInDay + 1}</p>
            <h3 className="break-words font-black leading-5">{item.name}</h3>
          </div>
        </div>
        <button type="button" className="min-h-11 shrink-0 px-1 text-xs font-bold text-[#b42318] sm:px-2" onClick={() => remove(item.draftId)}>Remover</button>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2" aria-label={`Ordenação de ${item.name}`}>
        <button type="button" className="min-w-0 rounded-xl border border-[#dfe5dc] px-2 py-2 text-xs font-bold disabled:opacity-40" disabled={positionInDay === 0} onClick={() => move(item.draftId, -1)} aria-label={`Mover ${item.name} para cima`}>↑ Subir</button>
        <button type="button" className="min-w-0 rounded-xl border border-[#dfe5dc] px-2 py-2 text-xs font-bold disabled:opacity-40" disabled={positionInDay === totalInDay - 1} onClick={() => move(item.draftId, 1)} aria-label={`Mover ${item.name} para baixo`}>↓ Descer</button>
        <span className="col-span-2 text-center text-[0.7rem] text-[#657168] sm:text-right">Arraste pela alça ou use os botões</span>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className="field"><label htmlFor={`day-${item.draftId}`}>Dia</label><input id={`day-${item.draftId}`} type="number" min="1" max="7" value={item.dayIndex + 1} onChange={(event) => update(index, { dayIndex: Number(event.target.value) - 1 })} /></div>
        <div className="field"><label htmlFor={`sets-${item.draftId}`}>Séries</label><input id={`sets-${item.draftId}`} type="number" min="1" max="12" value={item.targetSets} onChange={(event) => update(index, { targetSets: Number(event.target.value) })} /></div>
        <div className="field"><label htmlFor={`reps-${item.draftId}`}>Repetições</label><input id={`reps-${item.draftId}`} value={item.targetReps} maxLength={40} onChange={(event) => update(index, { targetReps: event.target.value })} /></div>
        <div className="field"><label htmlFor={`rest-${item.draftId}`}>Descanso (s)</label><input id={`rest-${item.draftId}`} type="number" min="15" max="900" step="5" value={item.restSeconds} onChange={(event) => update(index, { restSeconds: Number(event.target.value) })} /></div>
      </div>
    </div>
  );
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
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
  const draftDays = useMemo(() => [...new Set(draft.map((item) => item.dayIndex))].sort((left, right) => left - right), [draft]);

  function addExercise(exercise: CatalogExercise) {
    setDraft((current) => [
      ...current,
      {
        draftId: createDraftId(),
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

  function removeDraft(draftId: string) {
    setDraft((current) => current.filter((item) => item.draftId !== draftId));
  }

  function moveDraftWithinDay(draftId: string, direction: -1 | 1) {
    setDraft((current) => {
      const currentIndex = current.findIndex((item) => item.draftId === draftId);
      if (currentIndex < 0) return current;
      const dayIndexes = current.map((item, index) => item.dayIndex === current[currentIndex].dayIndex ? index : -1).filter((index) => index >= 0);
      const positionInDay = dayIndexes.indexOf(currentIndex);
      const targetIndex = dayIndexes[positionInDay + direction];
      return targetIndex === undefined ? current : arrayMove(current, currentIndex, targetIndex);
    });
  }

  function finishDrag(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((current) => {
      const currentIndex = current.findIndex((item) => item.draftId === active.id);
      const targetIndex = current.findIndex((item) => item.draftId === over.id);
      if (currentIndex < 0 || targetIndex < 0 || current[currentIndex].dayIndex !== current[targetIndex].dayIndex) return current;
      return arrayMove(current, currentIndex, targetIndex);
    });
  }

  function editPlan(plan: WorkoutPlan) {
    const version = plan.versions[0];
    setEditingId(plan.id);
    setPlanName(plan.name);
    setDivision(plan.division);
    setDraft(
      (version?.exercises ?? []).map((item) => ({
        draftId: createDraftId(),
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
      setDraft(result.proposal.exercises.map((exercise) => ({ draftId: createDraftId(), exerciseId: exercise.id, name: exercise.name, dayIndex: exercise.dayIndex, targetSets: exercise.targetSets, targetReps: exercise.targetReps, restSeconds: exercise.restSeconds })));
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
      setDraft(result.proposal.exercises.map((exercise) => ({ ...exercise, draftId: createDraftId() })));
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

  function renderActivePlans() {
    return (
      <section data-testid="workout-plans-section" className="mt-10" aria-labelledby="plans-title">
        <p className="eyebrow">Planos ativos</p>
        <h2 id="plans-title" className="mt-2 text-2xl font-black">Escolha o treino de hoje</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {activePlans.map((plan) => {
            const version = plan.versions[0];
            const days = [...new Set((version?.exercises ?? []).map((item) => item.dayIndex))];
            return (
              <article key={plan.id} data-testid="workout-active-plan" className="card min-w-0 max-w-full p-4 sm:p-6">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-[#eef4e9] px-3 py-1 text-xs font-black text-[#166534]">{plan.division === "FULL_BODY" ? "Full body" : `Divisão ${plan.division}`}</span>
                      {savedFocus(version?.generationInputs) && <span className="inline-flex rounded-full bg-[#f4f6f1] px-3 py-1 text-xs font-black text-[#52604e]">{savedFocus(version?.generationInputs)}</span>}
                    </div>
                    <h3 className="mt-2 break-words text-xl font-black">{plan.name}</h3>
                    <p className="mt-1 text-sm text-[#657168]">Versão {version?.version ?? 1} · {days.length} {days.length === 1 ? "dia" : "dias"}</p>
                    {version?.generatedByRuleVersion && <p className="mt-2 break-words text-xs font-bold text-[#725d00]">Sugestão gerada pela regra {version.generatedByRuleVersion} e confirmada após revisão.</p>}
                  </div>
                  <button className="shrink-0 rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold" onClick={() => editPlan(plan)}>Editar</button>
                </div>
                <div className="mt-5 grid min-w-0 gap-2">
                  {days.map((dayIndex) => {
                    const count = version?.exercises.filter((item) => item.dayIndex === dayIndex).length ?? 0;
                    return <button key={dayIndex} data-testid={`workout-day-${dayIndex}`} className="button-secondary w-full min-w-0 gap-2 whitespace-normal text-left !justify-between" disabled={pending || Boolean(activeSession)} onClick={() => startWorkout(plan.id, dayIndex)}><span className="min-w-0 break-words">{workoutDayLabel(plan.division, dayIndex)} · {count} exercícios</span><span className="shrink-0" aria-hidden="true">→</span></button>;
                  })}
                </div>
                <button className="mt-4 max-w-full text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => deletePlan(plan.id, plan.name)}>Excluir plano</button>
              </article>
            );
          })}
          {activePlans.length === 0 && <div className="card p-7 lg:col-span-2"><h3 className="text-xl font-black">Nenhum plano ativo</h3><p className="mt-3 text-[#657168]">Crie um plano manual ou gere uma sugestão revisável para começar.</p></div>}
        </div>
      </section>
    );
  }

  return (
    <>
      {activeSession && <section className="mt-8 rounded-[1.75rem] bg-[#153d28] p-6 text-white shadow-xl"><p className="text-xs font-black tracking-[.14em] text-[#d8f24a]">EM ANDAMENTO</p><h2 className="mt-2 text-2xl font-black">{activeSession.name}</h2><p className="mt-2 text-sm text-white/65">As séries já registradas estão salvas.</p><Link className="button-primary mt-5 w-full !bg-[#d8f24a] !text-[#17201b]" href={`/treino/sessao/${activeSession.id}`}>Retomar treino</Link></section>}

      {activePlans.length > 0 && renderActivePlans()}

      <div data-testid="workout-create-options" className="mt-6 grid gap-3 sm:grid-cols-2">
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
      {showBuilder && generation && (
        <section data-testid="workout-generation-review" className="mt-4 min-w-0 rounded-2xl border border-[#d9e5b5] bg-[#f8fce9] p-4 sm:p-5" aria-labelledby="generation-review-title">
          <p className="eyebrow">Sugestão gerada</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="generation-review-title" className="mr-auto text-lg font-black sm:text-xl">Revisão obrigatória antes de ativar</h2>
            <span className="rounded-full bg-[#166534] px-3 py-1.5 text-xs font-black text-white">{generationDivisionLabel(generation.division)} · {focusLabel(generation.focus)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Dias da sugestão">
            {generation.dayLabels.map((label, index) => {
              const day = generation.division === "FULL_BODY" ? String(index + 1) : String.fromCharCode(65 + index);
              return <span key={`${label}-${index}`} title={label} aria-label={`Dia ${day}: ${label}`} className="grid size-9 place-items-center rounded-full border border-[#d9e5b5] bg-white text-xs font-black text-[#166534]">{day}</span>;
            })}
          </div>
        </section>
      )}

      {showBuilder && (
        <section data-testid="workout-builder" className="card mt-4 min-w-0 max-w-full p-4 sm:p-7" aria-labelledby="builder-title">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{importReview ? "Importação JSON" : editingId ? "Nova versão" : generation ? "Sugestão gerada" : "Plano manual"}</p>
              <h2 id="builder-title" className="mt-2 break-words text-xl font-black sm:text-2xl">Monte seus dias de treino</h2>
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
                    <button key={exercise.id} type="button" className="flex min-h-12 min-w-0 max-w-full items-center justify-between gap-3 rounded-2xl border border-[#dfe5dc] bg-white px-4 py-3 text-left hover:border-[#166534]" onClick={() => addExercise(exercise)}>
                      <span className="min-w-0"><strong className="block break-words">{exercise.name}</strong><small className="mt-1 block break-words text-[#657168]">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</small></span>
                      <span className="shrink-0 text-xl font-black text-[#166534]" aria-hidden="true">+</span>
                    </button>
                  ))}
                  {filteredExercises.length === 0 && <p className="rounded-2xl bg-[#f4f6f1] p-4 text-sm text-[#657168]">Nenhum exercício encontrado. Tente outro termo.</p>}
                </div>
              )}
            </div>
      
            {draft.length > 0 && (
              <div className="grid gap-3">
                <div><p className="text-sm font-black">Seu plano · {draft.length} {draft.length === 1 ? "exercício" : "exercícios"}</p><p className="mt-1 text-xs leading-5 text-[#657168]">Segure a alça ⠿ e arraste para ordenar dentro do dia. No celular, você também pode usar “Subir” e “Descer”.</p></div>
                <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={finishDrag}>
                  {draftDays.map((dayIndex) => {
                    const dayItems = draft.filter((item) => item.dayIndex === dayIndex);
                    return (
                      <section key={dayIndex} data-testid={`workout-draft-day-${dayIndex}`} className="grid min-w-0 max-w-full gap-3 rounded-2xl bg-[#f4f6f1] p-2 sm:rounded-3xl sm:p-4" aria-labelledby={`draft-day-${dayIndex}`}>
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-1"><h3 id={`draft-day-${dayIndex}`} className="min-w-0 break-words font-black leading-5">{workoutDayLabel(division, dayIndex)}</h3><span className="whitespace-nowrap text-xs font-bold text-[#657168]">{dayItems.length} {dayItems.length === 1 ? "exercício" : "exercícios"}</span></div>
                        <SortableContext items={dayItems.map((item) => item.draftId)} strategy={verticalListSortingStrategy}>
                          {dayItems.map((item, positionInDay) => {
                            const index = draft.findIndex((candidate) => candidate.draftId === item.draftId);
                            return <SortableDraftExercise key={item.draftId} item={item} index={index} positionInDay={positionInDay} totalInDay={dayItems.length} update={updateDraft} remove={removeDraft} move={moveDraftWithinDay} />;
                          })}
                        </SortableContext>
                      </section>
                    );
                  })}
                </DndContext>
              </div>
            )}
      
            <button className="button-primary" disabled={pending}>{pending ? "Salvando…" : editingId ? "Criar nova versão" : "Salvar plano"}</button>
          </form>
        </section>
      )}

      {activePlans.length === 0 && renderActivePlans()}

      {archivedPlans.length > 0 && <section className="mt-10" aria-labelledby="archived-plans-title"><p className="eyebrow">Planos arquivados</p><h2 id="archived-plans-title" className="mt-2 text-2xl font-black">Limpe planos antigos</h2><div className="mt-4 grid gap-3">{archivedPlans.map((plan) => <article key={plan.id} className="grid min-w-0 max-w-full gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><h3 className="break-words font-black">{plan.name}</h3><p className="mt-1 text-xs text-[#657168]">{plan.division === "FULL_BODY" ? "Full body" : `Divisão ${plan.division}`}</p></div><button className="max-w-full whitespace-normal rounded-full border border-[#fecaca] px-3 py-2 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => deletePlan(plan.id, plan.name)}>Excluir definitivamente</button></article>)}</div></section>}

      {recentSessions.length > 0 && <section className="mt-10"><p className="eyebrow">Histórico recente</p><h2 className="mt-2 text-2xl font-black">Treinos concluídos</h2><div className="mt-4 grid gap-3">{recentSessions.map((session) => <Link key={session.id} href={`/treino/sessao/${session.id}`} className="flex items-center justify-between rounded-2xl border border-[#dfe5dc] bg-white p-5 text-inherit no-underline"><span><b>{session.name}</b><br /><small className="text-[#657168]">{session.completedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.completedAt)) : "Concluído"}</small></span><span aria-hidden="true">→</span></Link>)}</div></section>}
    </>
  );
}
