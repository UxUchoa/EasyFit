"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SetRecord = {
  id: string;
  setNumber: number;
  repetitions: number | null;
  weightKg: number | null;
  effortRpe: number | null;
  completedAt: string | null;
};

type SessionExercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string | null;
  replacedFromName: string | null;
  substitutionReason: string | null;
  substitutedAt: string | null;
  alternatives: Array<{ id: string; name: string; muscle: string; equipment: string | null }>;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: SetRecord[];
};

const substitutionReasonLabels: Record<string, string> = {
  EQUIPMENT_UNAVAILABLE: 'equipamento indisponível',
  COMFORT: 'conforto',
  PREFERENCE: 'preferência',
  OTHER: 'outro motivo',
};

export function WorkoutSessionClient({
  session,
}: {
  session: {
    id: string;
    name: string;
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    startedAt: string | null;
    completedAt: string | null;
    exercises: SessionExercise[];
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [restSeconds, setRestSeconds] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [restFinished, setRestFinished] = useState(false);
  const [manualRest, setManualRest] = useState(session.exercises[0]?.restSeconds ?? 60);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [replacingId, setReplacingId] = useState('');
  const [substitutionReason, setSubstitutionReason] = useState<'EQUIPMENT_UNAVAILABLE' | 'COMFORT' | 'PREFERENCE' | 'OTHER'>('PREFERENCE');

  useEffect(() => {
    if (restSeconds <= 0 || restPaused) return;
    const timer = window.setInterval(() => setRestSeconds((value) => {
      if (value <= 1) {
        setRestFinished(true);
        return 0;
      }
      return value - 1;
    }), 1_000);
    return () => window.clearInterval(timer);
  }, [restSeconds, restPaused]);

  const progress = useMemo(() => {
    const target = session.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
    const completed = session.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.completedAt).length,
      0,
    );
    return { target, completed, percent: target ? Math.min(100, Math.round((completed / target) * 100)) : 0 };
  }, [session.exercises]);

  async function saveSet(event: FormEvent<HTMLFormElement>, exercise: SessionExercise, setNumber: number) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const raw = String(data.get(name) ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    const response = await fetch(`/api/workout-sessions/${session.id}/sets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionExerciseId: exercise.id,
        setNumber,
        repetitions: optionalNumber("repetitions"),
        weightKg: optionalNumber("weightKg"),
        effortRpe: optionalNumber("effortRpe"),
        completed: true,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json()) as { error?: string }) : null;
      setError(result?.error ?? "Não foi possível salvar a série.");
    } else {
      setRestSeconds(exercise.restSeconds);
      setRestPaused(false);
      setRestFinished(false);
      router.refresh();
    }
    setPending(false);
  }

  async function finish(status: "COMPLETED" | "CANCELLED") {
    setPending(true);
    setError("");
    const response = await fetch(`/api/workout-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? ((await response.json()) as { error?: string }) : null;
      setError(result?.error ?? "Não foi possível atualizar o treino.");
    } else {
      router.push("/treino");
      router.refresh();
    }
    setPending(false);
  }

  async function substitute(exercise: SessionExercise, replacementExerciseId: string) {
    setPending(true); setError('');
    const response = await fetch('/api/workout-sessions/' + session.id + '/exercises/' + exercise.id + '/substitute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replacementExerciseId, reason: substitutionReason }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = response ? await response.json().catch(() => ({})) as { error?: string } : null;
      setError(result?.error ?? 'Não foi possível substituir o exercício.');
    } else {
      setReplacingId('');
      router.refresh();
    }
    setPending(false);
  }

  const readOnly = session.status !== "IN_PROGRESS";

  return (
    <>
      <section className="mt-7 overflow-hidden rounded-[1.75rem] bg-[#153d28] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[.14em] text-[#d8f24a]">{session.status === "IN_PROGRESS" ? "EM ANDAMENTO" : session.status === "COMPLETED" ? "CONCLUÍDO" : "ENCERRADO"}</p><h2 className="mt-2 text-2xl font-black">{session.name}</h2><p className="mt-2 text-sm text-white/60">{progress.completed} de {progress.target} séries registradas</p></div><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{progress.percent}%</span></div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d8f24a]" style={{ width: `${progress.percent}%` }} /></div>
      </section>

      {restSeconds > 0 && <aside className="sticky top-3 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#bed497] bg-[#f5ffd7] p-4 shadow-lg" aria-live="polite"><div><p className="text-xs font-black text-[#166534]">DESCANSO {restPaused ? "PAUSADO" : ""}</p><p className="mt-1 text-sm text-[#52604e]">Próxima série quando estiver confortável.</p></div><div className="flex items-center gap-2"><strong className="mr-1 text-2xl">{Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}</strong><button className="rounded-full border border-[#9daf72] px-3 py-2 text-xs font-black" onClick={() => setRestPaused((value) => !value)}>{restPaused ? "Retomar" : "Pausar"}</button><button className="rounded-full border border-[#9daf72] px-3 py-2 text-xs font-black" onClick={() => { setRestSeconds(0); setRestFinished(false); }}>Pular</button></div></aside>}

      <p role="status" aria-live="polite" className={`mt-4 min-h-6 text-sm font-bold ${error ? "text-[#b42318]" : "text-transparent"}`}>{error || "Tudo certo"}</p>
      {restFinished && <p role="status" aria-live="assertive" className="rounded-2xl border border-[#b9d8bb] bg-[#f2f8f1] p-4 text-sm font-black text-[#166534]">Descanso concluído. Continue quando estiver pronto.</p>}
      {!readOnly && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-[#dfe5dc] bg-white p-4"><div className="field flex-1"><label htmlFor="manual-rest">Cronômetro manual</label><select id="manual-rest" value={manualRest} onChange={(event) => setManualRest(Number(event.target.value))}>{[30, 45, 60, 75, 90, 120, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds} segundos</option>)}</select></div><button className="button-secondary !min-h-[3.25rem]" onClick={() => { setRestSeconds(manualRest); setRestPaused(false); setRestFinished(false); }}>Iniciar descanso</button></div>}
      <p className="mt-4 text-xs leading-5 text-[#657168]"><strong>RPE é opcional:</strong> use de 1 a 10 para registrar sua percepção de esforço naquela série. É apenas um registro subjetivo, não uma recomendação clínica.</p>

      <section className="mt-2 grid gap-5">
        {session.exercises.map((exercise, exerciseIndex) => {
          const existingByNumber = new Map(exercise.sets.map((set) => [set.setNumber, set]));
          const setCount = Math.max(exercise.targetSets, ...exercise.sets.map((set) => set.setNumber), 0);
          return <article key={exercise.id} className='card p-5 sm:p-7'>
            <div className='flex items-start justify-between gap-4'>
              <div><p className='eyebrow'>Exercício {exerciseIndex + 1}</p><h3 className='mt-2 text-xl font-black'>{exercise.name}</h3><p className='mt-1 text-sm text-[#657168]'>{exercise.muscle}{exercise.equipment && <> · {exercise.equipment}</>}</p>{exercise.replacedFromName && <p className='mt-2 text-xs font-bold text-[#725d00]'>Substituído de {exercise.replacedFromName} · motivo: {substitutionReasonLabels[exercise.substitutionReason ?? ''] ?? 'não informado'}</p>}</div>
              <span className='rounded-full bg-[#edf4eb] px-3 py-2 text-xs font-black text-[#166534]'>{exercise.targetSets} × {exercise.targetReps}</span>
            </div>
            {!readOnly && !exercise.sets.some((set) => set.completedAt) && exercise.alternatives.length > 0 && <div className='mt-4'><button className='rounded-full border border-[#dfe5dc] px-3 py-2 text-xs font-bold' type='button' onClick={() => setReplacingId(replacingId === exercise.id ? '' : exercise.id)}>Substituir exercício</button>{replacingId === exercise.id && <div className='mt-3 rounded-2xl border border-[#dfe5dc] bg-[#f8faf7] p-4'><div className='field max-w-sm'><label htmlFor={'substitution-reason-' + exercise.id}>Motivo</label><select id={'substitution-reason-' + exercise.id} value={substitutionReason} onChange={(event) => setSubstitutionReason(event.target.value as typeof substitutionReason)}><option value='PREFERENCE'>Preferência</option><option value='EQUIPMENT_UNAVAILABLE'>Equipamento indisponível</option><option value='COMFORT'>Conforto</option><option value='OTHER'>Outro motivo</option></select></div><p className='mt-4 text-sm font-black'>Alternativas compatíveis</p><div className='mt-2 flex flex-wrap gap-2'>{exercise.alternatives.map((alternative) => <button key={alternative.id} type='button' className='rounded-full border border-[#b9cfba] bg-white px-3 py-2 text-xs font-bold text-[#166534]' disabled={pending} onClick={() => substitute(exercise, alternative.id)}>{alternative.name}{alternative.equipment ? ' · ' + alternative.equipment : ''}</button>)}</div><p className='mt-3 text-xs leading-5 text-[#657168]'>A troca preserva o nome anterior no histórico e só é permitida antes da primeira série concluída.</p></div>}</div>}
            <div className='mt-5 grid gap-3'>{Array.from({ length: setCount }, (_, index) => index + 1).map((setNumber) => { const existing = existingByNumber.get(setNumber); return <form key={setNumber} onSubmit={(event) => saveSet(event, exercise, setNumber)} className={'grid grid-cols-[auto_1fr_1fr_1fr] items-end gap-2 rounded-2xl border p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] ' + (existing?.completedAt ? 'border-[#b9d8bb] bg-[#f2f8f1]' : 'border-[#e0e6de] bg-white')}><span className='grid size-9 place-items-center self-center rounded-full bg-[#edf1eb] text-sm font-black'>{setNumber}</span><div className='field'><label htmlFor={'reps-' + exercise.id + '-' + setNumber}>Reps</label><input id={'reps-' + exercise.id + '-' + setNumber} name='repetitions' type='number' min='0' max='1000' defaultValue={existing?.repetitions ?? ''} disabled={readOnly} /></div><div className='field'><label htmlFor={'weight-' + exercise.id + '-' + setNumber}>Kg</label><input id={'weight-' + exercise.id + '-' + setNumber} name='weightKg' type='number' min='0' max='5000' step='0.25' defaultValue={existing?.weightKg ?? ''} disabled={readOnly} /></div><div className='field'><label htmlFor={'rpe-' + exercise.id + '-' + setNumber}>RPE</label><input id={'rpe-' + exercise.id + '-' + setNumber} name='effortRpe' type='number' min='1' max='10' step='0.5' defaultValue={existing?.effortRpe ?? ''} disabled={readOnly} /></div>{!readOnly && <button className={'col-span-4 min-h-11 rounded-full px-4 text-xs font-black sm:col-span-1 ' + (existing?.completedAt ? 'border border-[#9fbea2] bg-white text-[#166534]' : 'bg-[#166534] text-white')} disabled={pending}>{existing?.completedAt ? 'Atualizar' : 'Concluir'}</button>}</form>; })}</div>
            <p className='mt-4 text-xs text-[#657168]'>Descanso sugerido: {exercise.restSeconds} s. Ajuste ou pule conforme necessário.</p>
          </article>;
        })}
      </section>

      {!readOnly && <section className="card mt-6 p-5 sm:p-6"><h2 className="text-lg font-black">Encerrar treino</h2><p className="mt-2 text-sm leading-6 text-[#657168]">Concluir mantém todas as séries registradas no histórico. Cancelar também preserva o que foi salvo, mas marca a sessão como cancelada.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button className="button-primary" disabled={pending} onClick={() => finish("COMPLETED")}>Concluir treino</button>{confirmCancel ? <div className="flex gap-2"><button className="button-secondary flex-1 !border-[#f0d5d2] !text-[#b42318]" disabled={pending} onClick={() => finish("CANCELLED")}>Confirmar cancelamento</button><button className="button-secondary !px-4" onClick={() => setConfirmCancel(false)}>Voltar</button></div> : <button className="button-secondary" onClick={() => setConfirmCancel(true)}>Cancelar treino</button>}</div></section>}
    </>
  );
}
