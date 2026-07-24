import type { Metadata } from "next";
import { OfflineStatus } from '@/components/offline-status';
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { findTodaySummaryDay } from "@/lib/diary/service";
import { aggregateNutrition } from "@/lib/diary/nutrition";
import { STANDARD_MEALS, mealLabel } from "@/lib/diary/constants";
import { dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate } from "@/lib/imports/snapshot";

export const metadata: Metadata = { title: "Hoje" };

export default async function TodayPage() {
  const user = await requireUser();
  const firstName = user.profile?.displayName.split(" ")[0] ?? user.username;
  const date = logicalDateKey(
    new Date(),
    user.profile?.timezone ?? "America/Sao_Paulo",
    user.profile?.dayClosesAtMinutes ?? 0,
  );
  const [goal, day, activeDietPlan] = await Promise.all([
    db.goalPlan.findFirst({
      where: { userId: user.id, validUntil: null },
      orderBy: { validFrom: "desc" },
      select: { calorieTarget: true, proteinGrams: true, carbohydrateGrams: true, fatGrams: true },
    }),
    findTodaySummaryDay(user.id, parseLogicalDate(date)!),
    db.dietPlan.findFirst({
      where: { userId: user.id, active: true },
      select: {
        name: true,
        versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } },
      },
    }),
  ]);
  const calorieTarget = goal?.calorieTarget ?? 0;
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
  const activeDietSnapshot = activeDietPlan?.versions[0]
    ? dietPlanSnapshotSchema.safeParse(activeDietPlan.versions[0].snapshot)
    : null;
  const activeDietItems = activeDietSnapshot?.success
    ? itemsForDietDate(activeDietSnapshot.data, date)
    : [];
  const activeDietMeals = new Map(
    groupDietItemsByMeal(activeDietItems).flatMap((meal) => meal.slug ? [[meal.slug, {
      itemCount: meal.items.length,
      resolvedCount: meal.items.filter((item) => item.nutrition !== null).length,
      calories: meal.items.reduce((sum, item) => sum + (item.nutrition?.calories ?? 0), 0),
      reviewCount: meal.items.filter((item) => item.nutrition === null).length,
    }] as const] : []),
  );

  return (
    <main className="shell pb-10 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Hoje</p>
          <h1 className="display mt-2 text-4xl font-bold sm:text-5xl">Olá, {firstName}.</h1>
          <p className="mt-3 text-[#657168]">Acompanhe o realizado sem cobranças ou julgamentos.</p>
        </div>
        <p className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-sm font-bold">
          {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00.000Z`))}
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
        <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Diário alimentar</p><h2 id="meals-title" className="mt-2 text-2xl font-black">Refeições</h2></div><Link href="/registro" className="text-sm font-black text-[#166534] underline-offset-4 hover:underline">Ver registro</Link></div>
        {activeDietPlan && (
          <aside className="mt-4 grid min-w-0 gap-3 rounded-2xl border border-[#cdddbf] bg-[#f4f9ec] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" aria-label={`Dieta ativa: ${activeDietPlan.name}`}>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[#166534]">Plano alimentar ativo</p>
              <p className="mt-1 break-words font-black">{activeDietPlan.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#657168]">{activeDietItems.length ? `${activeDietItems.length} ${activeDietItems.length === 1 ? "alimento prescrito" : "alimentos prescritos"} para hoje.` : "Este plano não possui refeições prescritas para hoje."}</p>
            </div>
            <Link href={`/dieta?date=${date}`} className="button-secondary w-full !min-h-11 !px-4 sm:w-auto">Ver dieta de hoje</Link>
          </aside>
        )}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {meals.map((meal) => {
            const label = mealLabel(meal.slug, meal.customName);
            const consumedEntries = meal.entries.filter((entry) => entry.kind === "CONSUMED");
            const plannedEntries = meal.entries.filter((entry) => entry.kind === 'PLANNED');
            const calories = consumedEntries.reduce((sum, entry) => sum + Number(entry.snapshotCalories), 0);
            const plannedCalories = plannedEntries.reduce((sum, entry) => sum + Number(entry.snapshotCalories), 0);
            const dietMeal = activeDietMeals.get(meal.slug);
            const plannedSummary = plannedEntries.length
              ? `${plannedEntries.length} ${plannedEntries.length === 1 ? "item planejado" : "itens planejados"} no diário · ${Math.round(plannedCalories)} kcal`
              : dietMeal
                ? `${dietMeal.itemCount} ${dietMeal.itemCount === 1 ? "alimento" : "alimentos"} na dieta${dietMeal.resolvedCount ? ` · ${Math.round(dietMeal.calories)} kcal previstas` : " · nutrientes a revisar"}${dietMeal.reviewCount ? ` · ${dietMeal.reviewCount} a revisar` : ""}`
                : "Nada planejado";
            return (
            <article key={meal.slug} data-testid={`today-meal-${meal.slug}`} className={`group flex min-h-32 min-w-0 items-center justify-between gap-3 rounded-2xl border bg-white p-5 ${dietMeal ? "border-[#cdddbf]" : "border-[#dfe5dc]"}`}>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className='font-black'>{label}</h3>{dietMeal && <span className="rounded-full bg-[#edf4e9] px-2 py-1 text-[9px] font-black text-[#166534]">NA DIETA</span>}</div><p className='mt-1 text-sm text-[#748078]'>{consumedEntries.length ? `${consumedEntries.length} ${consumedEntries.length === 1 ? 'item realizado' : 'itens realizados'} · ${Math.round(calories)} kcal` : 'Nada realizado'}</p><p className={`mt-1 break-words text-xs font-bold ${dietMeal || plannedEntries.length ? "text-[#725d00]" : "text-[#8a938c]"}`}>{plannedSummary}</p>{dietMeal && <Link href={`/dieta?date=${date}`} className="mt-2 inline-flex text-xs font-black text-[#166534] underline-offset-4 hover:underline">Ver refeição na dieta →</Link>}</div>
              <Link href={`/registro?date=${date}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf4eb] text-xl font-black text-[#166534] no-underline group-hover:bg-[#d8f24a]" aria-label={`Adicionar alimento em ${label}`}>+</Link>
            </article>
          )})}
        </div>
      </section>
    </main>
  );
}
