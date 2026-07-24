import type { Metadata } from "next";
import Link from "next/link";
import { ActiveDietPlan } from "@/components/active-diet-plan";
import { requireUser } from "@/lib/auth/session";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { db } from "@/lib/db";
import { dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate } from "@/lib/imports/snapshot";

export const metadata: Metadata = { title: "Dieta" };

function shiftedDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function DietPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = logicalDateKey(new Date(), user.profile?.timezone ?? "America/Sao_Paulo", user.profile?.dayClosesAtMinutes ?? 0);
  const date = params.date && parseLogicalDate(params.date) ? params.date : today;
  const activePlan = await db.dietPlan.findFirst({
    where: { userId: user.id, active: true },
    select: { name: true, versions: { orderBy: { version: "desc" }, take: 1, select: { snapshot: true } } },
  });
  const version = activePlan?.versions[0];
  const parsedSnapshot = version ? dietPlanSnapshotSchema.safeParse(version.snapshot) : null;
  const plannedItems = parsedSnapshot?.success ? itemsForDietDate(parsedSnapshot.data, date) : [];
  const plannedMeals = groupDietItemsByMeal(plannedItems).map((meal) => ({
    label: meal.label,
    slug: meal.slug,
    items: meal.items.map((item) => ({
      sourcePointer: item.sourcePointer,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.nutrition?.calories ?? null,
      proteinGrams: item.nutrition?.proteinGrams ?? null,
      carbohydrateGrams: item.nutrition?.carbohydrateGrams ?? null,
      fatGrams: item.nutrition?.fatGrams ?? null,
      source: item.catalog?.source ?? null,
    })),
  }));

  return (
    <main className="shell py-8">
      <p className="eyebrow">Plano alimentar</p>
      <h1 className="display mt-2 text-4xl font-bold">Siga sua dieta do dia.</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl leading-7 text-[#657168]">Aqui ficam somente as refeições prescritas, os nutrientes estimados e os itens que precisam de revisão.</p>
        <div className="flex flex-wrap gap-2">
          <Link className="button-secondary" href="/importacoes">Importar JSON</Link>
          <Link className="button-secondary" href={`/registro?date=${date}`}>Abrir registro</Link>
        </div>
      </div>

      <nav aria-label="Escolher dia da dieta" className="mt-6 flex items-center justify-between gap-3">
        <Link className="button-secondary !min-h-11 !px-4" href={`/dieta?date=${shiftedDate(date, -1)}`} aria-label="Dia anterior">←</Link>
        <time dateTime={date} className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2 text-center text-sm font-black">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}
        </time>
        <Link className="button-secondary !min-h-11 !px-4" href={`/dieta?date=${shiftedDate(date, 1)}`} aria-label="Próximo dia">→</Link>
      </nav>

      {activePlan && plannedMeals.length > 0 ? (
        <ActiveDietPlan key={date} planName={activePlan.name} dayLabel={plannedItems[0].day} date={date} meals={plannedMeals} />
      ) : (
        <section className="card mt-6 p-7 text-center sm:p-10">
          <p className="eyebrow">Sem refeições para este dia</p>
          <h2 className="mt-2 text-2xl font-black">{activePlan ? "O plano ativo não prescreve refeições nesta data." : "Você ainda não possui uma dieta ativa."}</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-[#657168]">Importe um plano em JSON ou navegue para outro dia da semana.</p>
          <Link className="button-primary mt-5" href="/importacoes">Importar dieta</Link>
        </section>
      )}
    </main>
  );
}
