import type { Metadata } from "next";
import { OfflineStatus } from '@/components/offline-status';
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { findDayLog } from "@/lib/diary/service";
import { aggregateNutrition } from "@/lib/diary/nutrition";
import { STANDARD_MEALS, mealLabel } from "@/lib/diary/constants";

export const metadata: Metadata = { title: "Hoje" };

export default async function TodayPage() {
  const user = await requireUser();
  const goal = await db.goalPlan.findFirst({
    where: { userId: user.id, validUntil: null },
    orderBy: { validFrom: "desc" },
  });
  const firstName = user.profile?.displayName.split(" ")[0] ?? user.username;
  const calorieTarget = goal?.calorieTarget ?? 0;
  const date = logicalDateKey(
    new Date(),
    user.profile?.timezone ?? "America/Sao_Paulo",
    user.profile?.dayClosesAtMinutes ?? 0,
  );
  const day = await findDayLog(user.id, parseLogicalDate(date)!);
  const entries = day?.meals.flatMap((meal) => meal.entries.filter((entry) => entry.kind === "CONSUMED")) ?? [];
  const totals = aggregateNutrition(
    entries.map((entry) => ({
      calories: Number(entry.snapshotCalories),
      proteinGrams: entry.snapshotProtein === null ? null : Number(entry.snapshotProtein),
      carbohydrateGrams:
        entry.snapshotCarbohydrate === null ? null : Number(entry.snapshotCarbohydrate),
      fatGrams: entry.snapshotFat === null ? null : Number(entry.snapshotFat),
    })),
  );
  const calorieProgress = calorieTarget
    ? Math.min(100, Math.round((totals.calories / calorieTarget) * 100))
    : 0;
  const calorieBalance = calorieTarget - totals.calories;
  const meals = day?.meals ?? STANDARD_MEALS.map((meal) => ({ ...meal, id: meal.slug, customName: null, entries: [] }));
  const activeWorkout = day?.workouts.find((workout) => workout.status === "IN_PROGRESS" || workout.status === "PLANNED");

  return (
    <main className="shell pb-10 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Hoje</p>
          <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Olá, {firstName}.</h1>
          <p className="mt-3 text-[#657168]">Acompanhe o realizado sem cobranças ou julgamentos.</p>
        </div>
        <p className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold">
          {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(new Date())}
        </p>
      </div>

      <OfflineStatus />
      <section aria-labelledby="nutrition-title" className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="rounded-[1.75rem] bg-[#153d28] p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-white/65">ENERGIA DO DIA</p><h2 id="nutrition-title" className="mt-2 text-3xl font-black">{Math.round(totals.calories).toLocaleString("pt-BR")} <span className="text-base font-medium text-white/60">de {calorieTarget.toLocaleString("pt-BR")} kcal</span></h2></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{calorieProgress}%</span></div>
          <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d8f24a]" style={{ width: `${calorieProgress}%` }} /></div>
          <p className='mt-3 text-sm font-bold text-white/75'>Saldo: <span className='text-white'>{Math.abs(Math.round(calorieBalance)).toLocaleString('pt-BR')} kcal {calorieBalance >= 0 ? 'restantes' : 'acima da meta'}</span></p>
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[["Proteína", totals.proteinGrams, goal?.proteinGrams], ["Carboidrato", totals.carbohydrateGrams, goal?.carbohydrateGrams], ["Gordura", totals.fatGrams, goal?.fatGrams]].map(([label, consumed, target]) => (
              <div key={String(label)}><p className="text-xl font-black">{Number(consumed).toFixed(0)} g</p><p className="mt-1 text-xs text-white/60">de {Number(target ?? 0).toFixed(0)} g · {label as string}</p></div>
            ))}
          </div>
          {!totals.macrosComplete && entries.length > 0 && <p className="mt-4 text-xs font-bold text-[#d8f24a]">Macros parciais: há entradas somente com calorias.</p>}
          <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/65">As metas são estimativas ajustáveis e não constituem orientação médica.</p>
        </div>

        <div className="card p-6 sm:p-7">
          <div className="flex items-center justify-between"><div><p className="eyebrow">Treino</p><h2 className="mt-2 text-xl font-black">{activeWorkout?.name ?? "Sem treino planejado"}</h2></div><span className="grid size-12 place-items-center rounded-full bg-[#edf4eb] text-xl" aria-hidden="true">↟</span></div>
          <p className="mt-4 leading-7 text-[#657168]">{activeWorkout?.status === "IN_PROGRESS" ? "Seu treino está em andamento e pode ser retomado." : "Monte um treino manual ou use um template para começar."}</p>
          <Link href={activeWorkout?.status === 'IN_PROGRESS' ? `/treino/sessao/${activeWorkout.id}` : '/treino'} className='button-secondary mt-6 w-full'>{activeWorkout?.status === 'IN_PROGRESS' ? 'Retomar treino' : 'Planejar treino'}</Link>
        </div>
      </section>

      <section aria-labelledby="meals-title" className="mt-10">
        <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Diário alimentar</p><h2 id="meals-title" className="mt-2 text-2xl font-black">Refeições</h2></div><Link href="/dieta" className="text-sm font-black text-[#166534] underline-offset-4 hover:underline">Ver diário</Link></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {meals.map((meal) => {
            const label = mealLabel(meal.slug, meal.customName);
            const consumedEntries = meal.entries.filter((entry) => entry.kind === "CONSUMED");
            const plannedEntries = meal.entries.filter((entry) => entry.kind === 'PLANNED');
            const calories = consumedEntries.reduce((sum, entry) => sum + Number(entry.snapshotCalories), 0);
            const plannedCalories = plannedEntries.reduce((sum, entry) => sum + Number(entry.snapshotCalories), 0);
            return (
            <article key={meal.slug} className="group flex min-h-28 items-center justify-between rounded-2xl border border-[#dfe5dc] bg-white p-5">
              <div><h3 className='font-black'>{label}</h3><p className='mt-1 text-sm text-[#748078]'>{consumedEntries.length ? `${consumedEntries.length} ${consumedEntries.length === 1 ? 'item realizado' : 'itens realizados'} · ${Math.round(calories)} kcal` : 'Nada realizado'}</p><p className='mt-1 text-xs font-bold text-[#8a6c00]'>{plannedEntries.length ? `${plannedEntries.length} planejado(s) · ${Math.round(plannedCalories)} kcal` : 'Nada planejado'}</p></div>
              <Link href={`/dieta?date=${date}`} className="grid size-11 place-items-center rounded-full bg-[#edf4eb] text-xl font-black text-[#166534] no-underline group-hover:bg-[#d8f24a]" aria-label={`Adicionar alimento em ${label}`}>+</Link>
            </article>
          )})}
        </div>
      </section>
    </main>
  );
}
