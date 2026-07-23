import type { Metadata } from "next";
import Link from "next/link";
import { ActiveDietPlan } from "@/components/active-diet-plan";
import { DiaryClient } from "@/components/diary-client";
import { requireUser } from "@/lib/auth/session";
import { STANDARD_MEALS, mealLabel } from "@/lib/diary/constants";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { findDiaryDay } from "@/lib/diary/service";
import { db } from "@/lib/db";
import { dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate } from "@/lib/imports/snapshot";

export const metadata: Metadata = { title: "Dieta" };

export default async function DietPage({ searchParams }: { searchParams: Promise<{ date?: string; barcode?: string; scanner?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = logicalDateKey(new Date(), user.profile?.timezone ?? "America/Sao_Paulo", user.profile?.dayClosesAtMinutes ?? 0);
  const date = params.date && parseLogicalDate(params.date) ? params.date : today;
  const selectedDate = parseLogicalDate(date)!;
  const [day, activePlan] = await Promise.all([
    findDiaryDay(user.id, selectedDate),
    db.dietPlan.findFirst({ where: { userId: user.id, active: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }),
  ]);
  const meals = day
    ? day.meals.map((meal) => ({
        id: meal.id,
        slug: meal.slug,
        label: mealLabel(meal.slug, meal.customName),
        custom: meal.kind === "CUSTOM",
        entries: meal.entries.map((entry) => ({
          id: entry.id,
          updatedAt: entry.updatedAt.toISOString(),
          kind: entry.kind,
          name: entry.snapshotName,
          brand: entry.snapshotBrand,
          quantity: Number(entry.quantity),
          unit: entry.unit,
          calories: Number(entry.snapshotCalories),
          proteinGrams: entry.snapshotProtein === null ? null : Number(entry.snapshotProtein),
          carbohydrateGrams:
            entry.snapshotCarbohydrate === null ? null : Number(entry.snapshotCarbohydrate),
          fatGrams: entry.snapshotFat === null ? null : Number(entry.snapshotFat),
          macrosComplete: entry.macrosComplete,
          revisions: entry.revisions.map((revision) => ({ id: revision.id, previousQuantity: Number(revision.previousQuantity), nextQuantity: Number(revision.nextQuantity), reason: revision.reason, correctedAt: revision.correctedAt.toISOString() })),
        })),
      }))
    : STANDARD_MEALS.map((meal) => ({ id: null, slug: meal.slug, label: meal.label, custom: false, entries: [] }));

  const version = activePlan?.versions[0];
  const parsedSnapshot = version ? dietPlanSnapshotSchema.safeParse(version.snapshot) : null;
  const plannedItems = parsedSnapshot?.success ? itemsForDietDate(parsedSnapshot.data, date) : [];
  const plannedMeals = groupDietItemsByMeal(plannedItems).map((meal) => ({
    label: meal.label,
    slug: meal.slug,
    items: meal.items.map((item) => ({
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

  return <main className='shell py-8'><p className='eyebrow'>Dieta</p><h1 className='display mt-2 text-4xl font-bold'>Seu diário alimentar.</h1><div className='mt-3 flex flex-wrap items-center justify-between gap-4'><p className='max-w-xl leading-7 text-[#657168]'>Registre o realizado e mantenha o histórico fiel ao que aconteceu naquele dia.</p><Link className='button-secondary' href='/importacoes'>Importar dieta em JSON</Link></div>{activePlan && plannedMeals.length > 0 && <ActiveDietPlan planName={activePlan.name} dayLabel={plannedItems[0].day} date={date} meals={plannedMeals} />}<DiaryClient key={date} date={date} today={today} userScope={user.id} meals={meals} initialBarcode={params.barcode?.slice(0, 14)} initialScanner={params.scanner === "1"} /></main>;
}
