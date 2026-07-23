import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { logicalDateKey, parseLogicalDate } from '@/lib/diary/date';
import { summarizeReportEntries, summarizeTrainingAdherence, trainingSetVolume } from '@/lib/reports/summaries';

export const metadata: Metadata = { title: 'Relatórios' };
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const shiftDate = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const formatNumber = (value: number, digits = 0) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const formatDate = (value: string | Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(typeof value === 'string' ? new Date(value + 'T12:00:00.000Z') : value);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ end?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const todayKey = logicalDateKey(new Date(), user.profile?.timezone ?? 'America/Sao_Paulo', user.profile?.dayClosesAtMinutes ?? 0);
  const requestedEnd = params.end ? parseLogicalDate(params.end) : null;
  const end = requestedEnd && params.end! <= todayKey ? requestedEnd : parseLogicalDate(todayKey)!;
  const start = shiftDate(end, -6);
  const startKey = keyOf(start);
  const endKey = keyOf(end);
  const historyStart = shiftDate(end, -89);

  const [days, goals, measurements, workoutSessions] = await Promise.all([
    db.dayLog.findMany({
      where: { userId: user.id, logicalDate: { gte: start, lte: end } },
      include: { goalPlan: true, meals: { include: { entries: true } } },
      orderBy: { logicalDate: 'asc' },
    }),
    db.goalPlan.findMany({
      where: { userId: user.id, validFrom: { lte: new Date(end.getTime() + DAY_MS - 1) }, OR: [{ validUntil: null }, { validUntil: { gt: start } }] },
      orderBy: { validFrom: 'desc' },
    }),
    db.bodyMeasurement.findMany({ where: { userId: user.id }, orderBy: { measuredAt: 'desc' }, take: 16 }),
    db.workoutSession.findMany({
      where: { userId: user.id, createdAt: { gte: historyStart } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { exercises: { orderBy: { position: 'asc' }, include: { sets: { where: { completedAt: { not: null } }, orderBy: { setNumber: 'asc' } } } } },
    }),
  ]);

  const dayByKey = new Map(days.map((day) => [keyOf(day.logicalDate), day]));
  const rows = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(start, index);
    const key = keyOf(date);
    const day = dayByKey.get(key);
    const entries = day?.meals.flatMap((meal) => meal.entries).map((entry) => ({
      kind: entry.kind,
      calories: Number(entry.snapshotCalories),
      proteinGrams: entry.snapshotProtein === null ? null : Number(entry.snapshotProtein),
      carbohydrateGrams: entry.snapshotCarbohydrate === null ? null : Number(entry.snapshotCarbohydrate),
      fatGrams: entry.snapshotFat === null ? null : Number(entry.snapshotFat),
      macrosComplete: entry.macrosComplete,
    })) ?? [];
    const summary = summarizeReportEntries(entries);
    const endOfDate = new Date(date.getTime() + DAY_MS - 1);
    const goal = day?.goalPlan ?? goals.find((candidate) => candidate.validFrom <= endOfDate && (!candidate.validUntil || candidate.validUntil > date)) ?? null;
    return { key, date, summary, goal };
  });

  const weekly = rows.reduce((total, row) => ({
    goal: total.goal + (row.goal?.calorieTarget ?? 0),
    consumed: total.consumed + row.summary.consumed.calories,
    planned: total.planned + row.summary.planned.calories,
    protein: total.protein + row.summary.consumed.proteinGrams,
    carbs: total.carbs + row.summary.consumed.carbohydrateGrams,
    fat: total.fat + row.summary.consumed.fatGrams,
    incompleteDays: total.incompleteDays + (row.summary.consumedCount > 0 && !row.summary.macrosComplete ? 1 : 0),
  }), { goal: 0, consumed: 0, planned: 0, protein: 0, carbs: 0, fat: 0, incompleteDays: 0 });
  const chartMaximum = Math.max(1, ...rows.flatMap((row) => [row.goal?.calorieTarget ?? 0, row.summary.consumed.calories, row.summary.planned.calories]));

  const adherence = summarizeTrainingAdherence(workoutSessions.map((session) => session.status));
  const setRows = workoutSessions.filter((session) => session.status === 'COMPLETED').flatMap((session) => session.exercises.flatMap((exercise) => exercise.sets.map((set) => ({
    id: set.id,
    date: session.completedAt!,
    exercise: exercise.nameSnapshot,
    repetitions: set.repetitions,
    weightKg: set.weightKg === null ? null : Number(set.weightKg),
    volume: trainingSetVolume(set.weightKg === null ? null : Number(set.weightKg), set.repetitions),
  })))).slice(0, 80);
  const exerciseTotals = new Map<string, { sets: number; volume: number; lastDate: Date }>();
  for (const row of setRows) {
    const current = exerciseTotals.get(row.exercise) ?? { sets: 0, volume: 0, lastDate: row.date };
    current.sets += 1;
    current.volume += row.volume ?? 0;
    if (row.date > current.lastDate) current.lastDate = row.date;
    exerciseTotals.set(row.exercise, current);
  }

  const orderedMeasurements = [...measurements].reverse();
  const weights = orderedMeasurements.map((item) => Number(item.weightKg));
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 0;
  const weightRange = Math.max(1, maxWeight - minWeight);
  const points = orderedMeasurements.map((item, index) => {
    const x = orderedMeasurements.length === 1 ? 300 : 30 + index * (540 / (orderedMeasurements.length - 1));
    const y = 150 - ((Number(item.weightKg) - minWeight) / weightRange) * 120;
    return String(x) + ',' + String(y);
  }).join(' ');

  const previousEnd = keyOf(shiftDate(end, -7));
  const possibleNext = shiftDate(end, 7);
  const nextEnd = possibleNext <= parseLogicalDate(todayKey)! ? keyOf(possibleNext) : todayKey;
  const hasNext = endKey < todayKey;

  return <main className='shell py-8'>
    <p className='eyebrow'>Relatórios</p>
    <div className='flex flex-wrap items-end justify-between gap-4'><div><h1 className='display mt-2 text-4xl font-bold'>Evolução sem julgamentos.</h1><p className='mt-3 max-w-2xl leading-7 text-[#657168]'>Compare metas, planejamento e registros reais. Valores incompletos permanecem identificados.</p></div><div className='flex gap-2'><Link className='button-secondary !min-h-11 !px-4' href={'/relatorios?end=' + previousEnd}>← Semana anterior</Link>{hasNext && <Link className='button-secondary !min-h-11 !px-4' href={'/relatorios?end=' + nextEnd}>Próxima →</Link>}</div></div>

    <section className='mt-8' aria-labelledby='nutrition-report-title'>
      <div className='flex flex-wrap items-end justify-between gap-3'><div><p className='eyebrow'>Nutrição</p><h2 id='nutrition-report-title' className='mt-2 text-2xl font-black'>Semana de {formatDate(startKey)} a {formatDate(endKey)}</h2></div><p className='text-sm font-bold text-[#657168]'>Fuso: {user.profile?.timezone ?? 'America/Sao_Paulo'}</p></div>
      <div className='mt-5 grid gap-3 sm:grid-cols-3'>
        <div className='card p-5'><p className='text-xs font-bold text-[#657168]'>REALIZADO</p><p className='mt-2 text-3xl font-black'>{formatNumber(weekly.consumed)} kcal</p><p className='mt-2 text-xs text-[#657168]'>P {formatNumber(weekly.protein)} g · C {formatNumber(weekly.carbs)} g · G {formatNumber(weekly.fat)} g</p></div>
        <div className='card p-5'><p className='text-xs font-bold text-[#657168]'>PLANEJADO</p><p className='mt-2 text-3xl font-black'>{formatNumber(weekly.planned)} kcal</p><p className='mt-2 text-xs text-[#657168]'>Total dos itens marcados como planejados.</p></div>
        <div className='card p-5'><p className='text-xs font-bold text-[#657168]'>META VÁLIDA</p><p className='mt-2 text-3xl font-black'>{formatNumber(weekly.goal)} kcal</p><p className='mt-2 text-xs font-bold text-[#8a6c00]'>{weekly.incompleteDays ? weekly.incompleteDays + ' dia(s) com macros parciais' : 'Macros realizados completos'}</p></div>
      </div>
      <div className='card mt-4 p-5 sm:p-6'>
        <div className='flex flex-wrap gap-4 text-xs font-bold'><span><i className='mr-2 inline-block size-3 rounded-sm bg-[#166534]' />Realizado</span><span><i className='mr-2 inline-block size-3 rounded-sm bg-[#d8f24a]' />Planejado</span><span><i className='mr-2 inline-block size-3 rounded-sm bg-[#d9dfd7]' />Meta</span></div>
        <div className='mt-5 grid gap-4'>{rows.map((row) => <div key={row.key} className='grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-center'><p className='text-sm font-black'>{formatDate(row.key)}</p><div className='grid gap-1'><div className='h-2 rounded-full bg-[#eef1ec]'><div className='h-2 rounded-full bg-[#d9dfd7]' style={{ width: String(((row.goal?.calorieTarget ?? 0) / chartMaximum) * 100) + '%' }} /></div><div className='h-2 rounded-full bg-[#eef1ec]'><div className='h-2 rounded-full bg-[#d8f24a]' style={{ width: String((row.summary.planned.calories / chartMaximum) * 100) + '%' }} /></div><div className='h-2 rounded-full bg-[#eef1ec]'><div className='h-2 rounded-full bg-[#166534]' style={{ width: String((row.summary.consumed.calories / chartMaximum) * 100) + '%' }} /></div></div></div>)}</div>
      </div>
      <div className='mt-4 overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white p-2'><table className='w-full min-w-[46rem] text-left text-sm'><caption className='sr-only'>Dados equivalentes do gráfico nutricional semanal</caption><thead><tr className='border-b border-[#dfe5dc] text-xs text-[#657168]'><th className='p-3'>Dia</th><th>Meta</th><th>Planejado</th><th>Realizado</th><th>Proteína</th><th>Carboidrato</th><th>Gordura</th><th>Qualidade</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className='border-b border-[#edf0eb]'><td className='p-3 font-bold'>{formatDate(row.key)}</td><td>{formatNumber(row.goal?.calorieTarget ?? 0)} kcal</td><td>{formatNumber(row.summary.planned.calories)} kcal</td><td>{formatNumber(row.summary.consumed.calories)} kcal</td><td>{formatNumber(row.summary.consumed.proteinGrams, 1)} g</td><td>{formatNumber(row.summary.consumed.carbohydrateGrams, 1)} g</td><td>{formatNumber(row.summary.consumed.fatGrams, 1)} g</td><td>{row.summary.consumedCount === 0 ? 'Sem registros' : row.summary.macrosComplete ? 'Completo' : 'Macros parciais'}</td></tr>)}</tbody></table></div>
    </section>

    <section className='mt-10' aria-labelledby='weight-report-title'>
      <p className='eyebrow'>Corpo</p><h2 id='weight-report-title' className='mt-2 text-2xl font-black'>Evolução de peso</h2>
      {orderedMeasurements.length ? <><div className='card mt-5 p-5'><svg viewBox='0 0 600 180' className='h-52 w-full' role='img' aria-label='Linha de evolução do peso; os valores exatos estão na tabela seguinte'><line x1='30' y1='150' x2='570' y2='150' stroke='#dfe5dc' /><polyline points={points} fill='none' stroke='#166534' strokeWidth='5' strokeLinecap='round' strokeLinejoin='round' />{orderedMeasurements.map((item, index) => { const [x, y] = points.split(' ')[index].split(','); return <circle key={item.id} cx={x} cy={y} r='6' fill='#d8f24a' stroke='#153d28' strokeWidth='3' />; })}</svg></div><div className='mt-4 overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white p-2'><table className='w-full text-left text-sm'><caption className='sr-only'>Tabela equivalente do gráfico de peso</caption><thead><tr className='border-b border-[#dfe5dc] text-xs text-[#657168]'><th className='p-3'>Data</th><th>Peso</th><th>Variação desde o registro anterior</th></tr></thead><tbody>{orderedMeasurements.map((item, index) => { const weight = Number(item.weightKg); const previous = index ? Number(orderedMeasurements[index - 1].weightKg) : null; const difference = previous === null ? null : weight - previous; return <tr key={item.id} className='border-b border-[#edf0eb]'><td className='p-3 font-bold'>{formatDate(item.measuredAt)}</td><td>{formatNumber(weight, 2)} kg</td><td>{difference === null ? 'Primeiro registro' : (difference > 0 ? '+' : '') + formatNumber(difference, 2) + ' kg'}</td></tr>; })}</tbody></table></div></> : <div className='card mt-5 p-6 text-sm text-[#657168]'>Registre peso e medidas no Perfil para acompanhar a evolução.</div>}
    </section>

    <section className='mt-10' aria-labelledby='training-report-title'>
      <p className='eyebrow'>Treino</p><h2 id='training-report-title' className='mt-2 text-2xl font-black'>Histórico por exercício</h2><p className='mt-2 text-sm leading-6 text-[#657168]'>Últimos 90 dias. Volume por série = carga × repetições; séries sem carga continuam visíveis sem volume inventado.</p>
      <div className='mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'><article className='card p-5'><p className='text-xs font-bold text-[#657168]'>SESSÕES PREVISTAS</p><p className='mt-2 text-3xl font-black'>{adherence.expected}</p><p className='mt-1 text-xs text-[#657168]'>{adherence.planned} ainda não iniciada(s)</p></article><article className='card p-5'><p className='text-xs font-bold text-[#657168]'>INICIADAS</p><p className='mt-2 text-3xl font-black'>{adherence.started}</p><p className='mt-1 text-xs text-[#657168]'>{adherence.inProgress} em andamento</p></article><article className='card p-5'><p className='text-xs font-bold text-[#657168]'>CONCLUÍDAS</p><p className='mt-2 text-3xl font-black'>{adherence.completed}</p><p className='mt-1 text-xs text-[#657168]'>{adherence.cancelled} cancelada(s)</p></article><article className='card p-5'><p className='text-xs font-bold text-[#657168]'>ADERÊNCIA</p><p className='mt-2 text-3xl font-black'>{adherence.adherencePercent === null ? '—' : adherence.adherencePercent + '%'}</p><p className='mt-1 text-xs text-[#657168]'>Concluídas ÷ todas as sessões previstas no período.</p></article></div>
      {exerciseTotals.size > 0 && <div className='mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>{[...exerciseTotals.entries()].map(([name, total]) => <article className='card p-5' key={name}><h3 className='font-black'>{name}</h3><p className='mt-2 text-sm text-[#657168]'>{total.sets} séries · {formatNumber(total.volume, 1)} kg de volume</p><p className='mt-1 text-xs text-[#657168]'>Último treino: {formatDate(total.lastDate)}</p></article>)}</div>}
      <div className='mt-4 overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white p-2'><table className='w-full min-w-[40rem] text-left text-sm'><caption className='sr-only'>Séries concluídas por exercício</caption><thead><tr className='border-b border-[#dfe5dc] text-xs text-[#657168]'><th className='p-3'>Data</th><th>Exercício</th><th>Carga</th><th>Repetições</th><th>Volume</th></tr></thead><tbody>{setRows.map((row) => <tr key={row.id} className='border-b border-[#edf0eb]'><td className='p-3 font-bold'>{formatDate(row.date)}</td><td>{row.exercise}</td><td>{row.weightKg === null ? 'Não informada' : formatNumber(row.weightKg, 2) + ' kg'}</td><td>{row.repetitions ?? 'Não informadas'}</td><td>{row.volume === null ? '—' : formatNumber(row.volume, 2) + ' kg'}</td></tr>)}</tbody></table>{!setRows.length && <p className='p-5 text-sm text-[#657168]'>Conclua um treino para ver séries, carga, repetições e volume.</p>}</div>
    </section>
  </main>;
}
