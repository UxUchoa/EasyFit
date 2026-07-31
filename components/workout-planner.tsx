"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

const DIVISION_DAY_COUNTS: Record<string, number> = {
  FULL_BODY: 1,
  A: 1,
  AB: 2,
  ABC: 3,
  ABCD: 4,
  ABCDE: 5,
  CUSTOM: 7,
};

function workoutDayLabel(division: string, dayIndex: number) {
  if (division === "FULL_BODY") return `Full body · Dia ${dayIndex + 1}`;
  const sector = DIVISION_DAY_LABELS[division]?.[dayIndex];
  const letter = division !== "CUSTOM" ? String.fromCharCode(65 + dayIndex) : `Dia ${dayIndex + 1}`;
  return sector ? `${letter} · ${sector}` : letter;
}

function workoutDayShortLabel(division: string, dayIndex: number) {
  if (division === "FULL_BODY") return "Dia 1";
  if (division === "CUSTOM") return `Dia ${dayIndex + 1}`;
  return `Treino ${String.fromCharCode(65 + dayIndex)}`;
}

function workoutDayMark(division: string, dayIndex: number) {
  return division === "FULL_BODY" || division === "CUSTOM" ? String(dayIndex + 1) : String.fromCharCode(65 + dayIndex);
}

function divisionDayIndexes(division: string) {
  return Array.from({ length: DIVISION_DAY_COUNTS[division] ?? 7 }, (_, index) => index);
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
  division,
  dayIndexes,
  positionInDay,
  totalInDay,
  update,
  moveToDay,
  remove,
  move,
}: {
  item: DraftExercise;
  division: string;
  dayIndexes: number[];
  positionInDay: number;
  totalInDay: number;
  update: (draftId: string, update: Partial<DraftExercise>) => void;
  moveToDay: (draftId: string, dayIndex: number) => void;
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
        <fieldset className="field col-span-2 lg:col-span-4"><legend>Mover para outro treino</legend><div className="flex flex-wrap gap-2">{dayIndexes.map((dayIndex) => { const selected = dayIndex === item.dayIndex; return <button key={dayIndex} type="button" aria-pressed={selected} aria-label={selected ? `${item.name} está no ${workoutDayShortLabel(division, dayIndex)}` : `Mover ${item.name} para ${workoutDayShortLabel(division, dayIndex)}`} data-testid={`move-${item.draftId}-to-${dayIndex}`} className={`grid min-h-11 min-w-11 place-items-center rounded-xl border px-3 text-sm font-black ${selected ? "border-[#166534] bg-[#166534] text-white" : "border-[#cbd4ca] bg-white text-[#166534]"}`} disabled={selected} onClick={() => moveToDay(item.draftId, dayIndex)}>{selected ? "✓ " : ""}{workoutDayMark(division, dayIndex)}</button>; })}</div></fieldset>
        <div className="field"><label htmlFor={`sets-${item.draftId}`}>Séries</label><input id={`sets-${item.draftId}`} type="number" inputMode="numeric" min="1" max="12" value={item.targetSets} onChange={(event) => update(item.draftId, { targetSets: Number(event.target.value) })} /></div>
        <div className="field"><label htmlFor={`reps-${item.draftId}`}>Repetições</label><input id={`reps-${item.draftId}`} value={item.targetReps} maxLength={40} onChange={(event) => update(item.draftId, { targetReps: event.target.value })} /></div>
        <div className="field col-span-2 lg:col-span-1"><label htmlFor={`rest-${item.draftId}`}>Descanso (segundos)</label><input id={`rest-${item.draftId}`} type="number" inputMode="numeric" min="15" max="900" step="5" value={item.restSeconds} onChange={(event) => update(item.draftId, { restSeconds: Number(event.target.value) })} /></div>
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
  const builderDialogRef = useRef<HTMLDialogElement>(null);
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
  const [activeDraftDay, setActiveDraftDay] = useState(0);
  const [builderNotice, setBuilderNotice] = useState("");
  const [importReview, setImportReview] = useState<{ filename: string; dayLabels: string[] } | null>(null);
  const activePlans = plans.filter((plan) => plan.active);
  const archivedPlans = plans.filter((plan) => !plan.active);
  const filteredExercises = useMemo(() => {
    const query = normalizedSearch(exerciseQuery);
    if (query.length < 2) return [];
    return exercises.filter((exercise) => normalizedSearch(`${exercise.name} ${exercise.muscleGroup} ${exercise.equipment ?? ""}`).includes(query)).slice(0, 12);
  }, [exerciseQuery, exercises]);
  const dayIndexes = useMemo(() => divisionDayIndexes(division), [division]);
  const draftDayCounts = useMemo(() => new Map(dayIndexes.map((dayIndex) => [dayIndex, draft.filter((item) => item.dayIndex === dayIndex).length])), [dayIndexes, draft]);

  useEffect(() => {
    const dialog = builderDialogRef.current;
    if (showBuilder && dialog && !dialog.open) dialog.showModal();
    if (!showBuilder && dialog?.open) dialog.close();
  }, [showBuilder]);

  function addExercise(exercise: CatalogExercise) {
    setDraft((current) => [
      ...current,
      {
        draftId: createDraftId(),
        exerciseId: exercise.id,
        name: exercise.name,
        dayIndex: activeDraftDay,
        targetSets: 3,
        targetReps: "8–12",
        restSeconds: 75,
      },
    ]);
    setBuilderNotice(`${exercise.name} adicionado ao ${workoutDayShortLabel(division, activeDraftDay)}.`);
  }

  function updateDraft(draftId: string, update: Partial<DraftExercise>) {
    setDraft((current) => current.map((item) => item.draftId === draftId ? { ...item, ...update } : item));
  }

  function moveDraftToDay(draftId: string, dayIndex: number) {
    const exerciseName = draft.find((candidate) => candidate.draftId === draftId)?.name ?? "Exercício";
    setDraft((current) => {
      const item = current.find((candidate) => candidate.draftId === draftId);
      if (!item || item.dayIndex === dayIndex) return current;
      const withoutItem = current.filter((candidate) => candidate.draftId !== draftId);
      const lastTargetIndex = withoutItem.reduce((last, candidate, index) => candidate.dayIndex === dayIndex ? index : last, -1);
      const moved = { ...item, dayIndex };
      if (lastTargetIndex < 0) return [...withoutItem, moved];
      return [...withoutItem.slice(0, lastTargetIndex + 1), moved, ...withoutItem.slice(lastTargetIndex + 1)];
    });
    setActiveDraftDay(dayIndex);
    setBuilderNotice(`${exerciseName} movido para ${workoutDayShortLabel(division, dayIndex)}.`);
  }

  function changeDivision(nextDivision: string) {
    const lastDayIndex = (DIVISION_DAY_COUNTS[nextDivision] ?? 7) - 1;
    setDivision(nextDivision);
    setDraft((current) => current.map((item) => item.dayIndex > lastDayIndex ? { ...item, dayIndex: lastDayIndex } : item));
    setActiveDraftDay((current) => Math.min(current, lastDayIndex));
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
    setActiveDraftDay(0);
    setBuilderNotice("");
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
      setActiveDraftDay(0);
      setBuilderNotice("");
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
      setActiveDraftDay(0);
      setBuilderNotice("");
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

  async function finishActiveWorkout() {
    if (!activeSession) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/workout-sessions/${activeSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      setError(result?.error ?? "Não foi possível concluir o treino em andamento.");
    } else {
      router.push(`/treino/sessao/${activeSession.id}`);
      router.refresh();
    }
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
        <p className="eyebrow">Seus planos</p>
        <h2 id="plans-title" className="mt-2 text-2xl font-black">Qual treino você vai fazer?</h2>
        <p className="mt-2 text-sm leading-6 text-[#657168]">Toque em um dia para começar ou edite o plano para trocar exercícios e ajustar séries.</p>
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
                  <button className="min-h-11 shrink-0 rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-xs font-bold text-[#166534]" onClick={() => editPlan(plan)}>Editar</button>
                </div>
                <div className="mt-5 grid min-w-0 gap-2">
                  {days.map((dayIndex) => {
                    const count = version?.exercises.filter((item) => item.dayIndex === dayIndex).length ?? 0;
                    const dayMark = plan.division === "FULL_BODY" || plan.division === "CUSTOM" ? String(dayIndex + 1) : String.fromCharCode(65 + dayIndex);
                    return <button key={dayIndex} data-testid={`workout-day-${dayIndex}`} className="grid min-h-16 w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-3 text-left transition hover:border-[#9eb29d] hover:shadow-md disabled:opacity-60" disabled={pending} onClick={() => startWorkout(plan.id, dayIndex)}><span className="grid size-10 place-items-center rounded-xl bg-[#eef4e9] text-sm font-black text-[#166534]">{dayMark}</span><span className="min-w-0"><strong className="block break-words text-sm">{workoutDayLabel(plan.division, dayIndex)}</strong><small className="mt-1 block text-xs text-[#657168]">{count} {count === 1 ? "exercício" : "exercícios"}</small></span><span className="shrink-0 text-lg text-[#166534]" aria-hidden="true">→</span></button>;
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
      {activeSession && <section data-testid="active-workout-resume" className="mt-8 rounded-[1.75rem] bg-[#153d28] p-6 text-white shadow-xl"><p className="text-xs font-black tracking-[.14em] text-[#d8f24a]">EM ANDAMENTO</p><h2 className="mt-2 text-2xl font-black">{activeSession.name}</h2><p className="mt-2 text-sm text-white/65">As séries já registradas estão salvas. Você pode retomar ou encerrar este treino por aqui.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link className="button-primary w-full !bg-[#d8f24a] !text-[#17201b]" href={`/treino/sessao/${activeSession.id}`}>Retomar treino</Link><button data-testid="complete-active-workout" type="button" className="button-secondary w-full !border-white/25 !bg-transparent !text-white" disabled={pending} onClick={finishActiveWorkout}>{pending ? "Concluindo…" : "Já concluí este treino"}</button></div></section>}

      {activePlans.length > 0 && renderActivePlans()}

      <div data-testid="workout-create-options" className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="button-primary" onClick={() => { setShowBuilder(true); setEditingId(null); setPlanName(""); setDivision("CUSTOM"); setDraft([]); setGeneration(null); setImportReview(null); setExerciseQuery(""); setActiveDraftDay(0); setBuilderNotice(""); setError(""); }}>Criar plano manual</button>
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
      {!showBuilder && <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>{error || "Tudo certo"}</p>}

      <dialog ref={builderDialogRef} className="app-dialog m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-[1.75rem] border border-[#dfe5dc] bg-[#f8faf6] p-0 text-[#17201b] shadow-2xl backdrop:bg-[#07120c]/70" aria-labelledby="builder-title" onCancel={(event) => { event.preventDefault(); setShowBuilder(false); }} onClose={() => setShowBuilder(false)}>
        {showBuilder && (
        <section data-testid="workout-builder" className="w-full min-w-0 max-w-full overflow-x-hidden" aria-labelledby="builder-title">
          <header className="sticky top-0 z-20 grid min-w-0 grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-3 border-b border-[#dfe5dc] bg-[#f8faf6]/95 px-4 py-4 backdrop-blur-xl sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p className="eyebrow">{importReview ? "Importação JSON" : editingId ? "Editando plano" : generation ? "Sugestão gerada" : "Novo plano"}</p>
              <h2 id="builder-title" className="mt-1 break-words text-xl font-black sm:text-2xl">{editingId ? "Ajuste seus treinos" : "Monte seus dias de treino"}</h2>
            </div>
            <button type="button" className="grid size-11 place-items-center rounded-full border border-[#dfe5dc] bg-white text-xl" onClick={() => setShowBuilder(false)} aria-label="Fechar editor de treino">×</button>
          </header>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 p-4 pb-0 sm:p-7 sm:pb-0">
            {generation && (
              <section data-testid="workout-generation-review" className="min-w-0 rounded-2xl border border-[#d9e5b5] bg-[#f8fce9] p-4 sm:p-5" aria-labelledby="generation-review-title">
                <p className="eyebrow">Sugestão gerada</p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <h3 id="generation-review-title" className="mr-auto text-lg font-black sm:text-xl">Revisão obrigatória antes de ativar</h3>
                  <span className="rounded-full bg-[#166534] px-3 py-1.5 text-xs font-black text-white">{generationDivisionLabel(generation.division)} · {focusLabel(generation.focus)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Dias da sugestão">{generation.dayLabels.map((label, index) => { const day = generation.division === "FULL_BODY" ? String(index + 1) : String.fromCharCode(65 + index); return <span key={`${label}-${index}`} title={label} aria-label={`Dia ${day}: ${label}`} className="grid size-9 place-items-center rounded-full border border-[#d9e5b5] bg-white text-xs font-black text-[#166534]">{day}</span>; })}</div>
              </section>
            )}

            {importReview && (
              <section className="rounded-2xl border border-[#d9e5b5] bg-[#f8fce9] p-4" aria-label="Revisão da importação">
                <p className="font-black text-[#166534]">Arquivo validado: {importReview.filename}</p>
                <p className="mt-2 text-sm leading-6 text-[#657168]">Revise exercícios, treinos, séries, repetições e descansos antes de salvar.</p>
              </section>
            )}
          </div>

          <form onSubmit={submitPlan} className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-6 p-4 sm:p-7">
            <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <div className="field"><label htmlFor="plan-name">Nome do plano</label><input id="plan-name" value={planName} onChange={(event) => setPlanName(event.target.value)} minLength={2} maxLength={120} required placeholder="Ex.: Treino da semana" /></div>
              <div className="field"><label htmlFor="plan-division">Divisão do plano</label><select id="plan-division" value={division} disabled={Boolean(generation)} onChange={(event) => changeDivision(event.target.value)}><option value="FULL_BODY">Full body</option><option value="A">A · Um treino</option><option value="AB">AB · Dois treinos</option><option value="ABC">ABC · Três treinos</option><option value="ABCD">ABCD · Quatro treinos</option><option value="ABCDE">ABCDE · Cinco treinos</option><option value="CUSTOM">Personalizada · Até 7 dias</option></select></div>
            </div>

            <section className="rounded-2xl border border-[#cfdacb] bg-[#eef4e9] p-3 sm:p-5" aria-labelledby="add-exercise-title">
              <div className="mb-4"><h3 id="add-exercise-title" className="font-black">Adicionar exercício</h3><p className="mt-1 text-xs leading-5 text-[#52604e]">Escolha primeiro o treino de destino. O exercício já entra no lugar certo.</p></div>
              <fieldset className="field"><legend>Adicionar no treino</legend><div className="flex flex-wrap gap-2">{dayIndexes.map((dayIndex) => { const selected = dayIndex === activeDraftDay; return <button key={dayIndex} type="button" aria-pressed={selected} aria-label={`Adicionar no ${workoutDayShortLabel(division, dayIndex)}`} className={`grid min-h-11 min-w-11 place-items-center rounded-xl border px-3 text-sm font-black ${selected ? "border-[#166534] bg-[#166534] text-white" : "border-[#b7c5b4] bg-white text-[#166534]"}`} onClick={() => { setActiveDraftDay(dayIndex); setBuilderNotice(`Os próximos exercícios serão adicionados ao ${workoutDayShortLabel(division, dayIndex)}.`); }}>{selected ? "✓ " : ""}{workoutDayMark(division, dayIndex)}</button>; })}</div></fieldset>
              <div className="field mt-3"><label htmlFor="exercise-search">Pesquisar no catálogo</label><input id="exercise-search" type="search" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="Ex.: cadeira extensora" autoComplete="off" /></div>
              {exerciseQuery.trim().length < 2 && <p className="mt-2 text-xs leading-5 text-[#657168]">Busque por nome, grupo muscular ou equipamento.</p>}
              {exerciseQuery.trim().length >= 2 && (
                <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1" aria-live="polite">
                  {filteredExercises.map((exercise) => <button key={exercise.id} type="button" className="flex min-h-14 min-w-0 max-w-full items-center justify-between gap-3 rounded-2xl border border-[#dfe5dc] bg-white px-4 py-3 text-left hover:border-[#166534]" aria-label={`Adicionar ${exercise.name} ao ${workoutDayShortLabel(division, activeDraftDay)}`} onClick={() => addExercise(exercise)}><span className="min-w-0"><strong className="block break-words">{exercise.name}</strong><small className="mt-1 block break-words text-[#657168]">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</small></span><span className="shrink-0 rounded-full bg-[#eef4e9] px-3 py-2 text-xs font-black text-[#166534]">Adicionar ao {workoutDayMark(division, activeDraftDay)}</span></button>)}
                  {filteredExercises.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-[#657168]">Nenhum exercício encontrado. Tente outro termo.</p>}
                </div>
              )}
            </section>

            <section aria-labelledby="plan-days-title">
              <div className="flex items-end justify-between gap-3"><div><h3 id="plan-days-title" className="font-black">Treinos do plano</h3><p className="mt-1 text-xs text-[#657168]">{draft.length} {draft.length === 1 ? "exercício" : "exercícios"} no total</p></div><p className="hidden text-xs text-[#657168] sm:block">Arraste ou use Subir/Descer para ordenar</p></div>
              <div className="mt-4 flex flex-wrap gap-2 pb-2" role="tablist" aria-label="Treinos do plano">{dayIndexes.map((dayIndex) => { const dayMark = workoutDayMark(division, dayIndex); return <button key={dayIndex} type="button" role="tab" aria-selected={activeDraftDay === dayIndex} data-testid={`draft-day-tab-${dayIndex}`} className={`min-h-12 rounded-full border px-3 text-left text-sm font-black sm:px-4 ${activeDraftDay === dayIndex ? "border-[#166534] bg-[#166534] text-white" : "border-[#dfe5dc] bg-white text-[#334039]"}`} onClick={() => setActiveDraftDay(dayIndex)}><span className="sm:hidden">{dayMark}</span><span className="hidden sm:inline">{workoutDayShortLabel(division, dayIndex)}</span><span className={`ml-2 rounded-full px-2 py-1 text-[.68rem] ${activeDraftDay === dayIndex ? "bg-white/15" : "bg-[#eef4e9] text-[#166534]"}`}>{draftDayCounts.get(dayIndex) ?? 0}</span></button>; })}</div>
              {builderNotice && <p role="status" aria-live="polite" className="mb-2 rounded-xl bg-[#e3f3dc] px-3 py-2 text-xs font-bold text-[#166534]">✓ {builderNotice}</p>}

              {dayIndexes.map((dayIndex) => {
                if (dayIndex !== activeDraftDay) return null;
                const dayItems = draft.filter((item) => item.dayIndex === dayIndex);
                return <DndContext key={dayIndex} sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={finishDrag}><section data-testid={`workout-draft-day-${dayIndex}`} className="mt-2 grid min-w-0 max-w-full gap-3 rounded-2xl bg-[#f4f6f1] p-2 sm:rounded-3xl sm:p-4" aria-labelledby={`draft-day-${dayIndex}`}><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-1"><div className="min-w-0"><h4 id={`draft-day-${dayIndex}`} className="break-words font-black leading-5">{workoutDayLabel(division, dayIndex)}</h4><p className="mt-1 text-xs text-[#657168]">{dayItems.length ? `${dayItems.length} ${dayItems.length === 1 ? "exercício" : "exercícios"}` : "Nenhum exercício neste treino"}</p></div><button type="button" className="rounded-full border border-[#cbd4ca] bg-white px-3 py-2 text-xs font-black text-[#166534]" onClick={() => document.getElementById("exercise-search")?.focus()}>+ Adicionar</button></div>{dayItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#b8c5b6] bg-white/60 p-5 text-center text-sm text-[#657168]">Pesquise um exercício acima para adicioná-lo diretamente aqui.</div>}<SortableContext items={dayItems.map((item) => item.draftId)} strategy={verticalListSortingStrategy}>{dayItems.map((item, positionInDay) => <SortableDraftExercise key={item.draftId} item={item} division={division} dayIndexes={dayIndexes} positionInDay={positionInDay} totalInDay={dayItems.length} update={updateDraft} moveToDay={moveDraftToDay} remove={removeDraft} move={moveDraftWithinDay} />)}</SortableContext></section></DndContext>;
              })}
            </section>

            {error && <p role="alert" className="rounded-2xl border border-[#f0d5d2] bg-[#fff7f6] p-4 text-sm font-bold text-[#b42318]">{error}</p>}

            <footer className="sticky bottom-0 z-20 -mx-4 -mb-4 grid gap-2 border-t border-[#dfe5dc] bg-[#f8faf6]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-7 sm:-mb-7 sm:grid-cols-[auto_minmax(15rem,1fr)] sm:px-7 sm:pb-5">
              <button type="button" className="button-secondary sm:order-first" onClick={() => setShowBuilder(false)}>Cancelar</button>
              <button className="button-primary sm:order-last" disabled={pending}>{pending ? "Salvando…" : editingId ? "Salvar nova versão" : "Salvar plano"}</button>
            </footer>
          </form>
        </section>
        )}
      </dialog>

      {activePlans.length === 0 && renderActivePlans()}

      {archivedPlans.length > 0 && <section className="mt-10" aria-labelledby="archived-plans-title"><p className="eyebrow">Planos arquivados</p><h2 id="archived-plans-title" className="mt-2 text-2xl font-black">Limpe planos antigos</h2><div className="mt-4 grid gap-3">{archivedPlans.map((plan) => <article key={plan.id} className="grid min-w-0 max-w-full gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><h3 className="break-words font-black">{plan.name}</h3><p className="mt-1 text-xs text-[#657168]">{plan.division === "FULL_BODY" ? "Full body" : `Divisão ${plan.division}`}</p></div><button className="max-w-full whitespace-normal rounded-full border border-[#fecaca] px-3 py-2 text-xs font-bold text-[#b42318]" disabled={pending} onClick={() => deletePlan(plan.id, plan.name)}>Excluir definitivamente</button></article>)}</div></section>}

      {recentSessions.length > 0 && <section className="mt-10"><p className="eyebrow">Histórico recente</p><h2 className="mt-2 text-2xl font-black">Treinos concluídos</h2><div className="mt-4 grid gap-3">{recentSessions.map((session) => <Link key={session.id} href={`/treino/sessao/${session.id}`} className="flex items-center justify-between rounded-2xl border border-[#dfe5dc] bg-white p-5 text-inherit no-underline"><span><b>{session.name}</b><br /><small className="text-[#657168]">{session.completedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.completedAt)) : "Concluído"}</small></span><span aria-hidden="true">→</span></Link>)}</div></section>}
    </>
  );
}
