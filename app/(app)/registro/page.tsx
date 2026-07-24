import type { Metadata } from "next";
import Link from "next/link";
import { DiaryClient } from "@/components/diary-client";
import { requireUser } from "@/lib/auth/session";
import { STANDARD_MEALS, mealLabel } from "@/lib/diary/constants";
import { logicalDateKey, parseLogicalDate } from "@/lib/diary/date";
import { findDiaryDay } from "@/lib/diary/service";

export const metadata: Metadata = { title: "Registro alimentar" };

export default async function FoodLogPage({ searchParams }: { searchParams: Promise<{ date?: string; barcode?: string; scanner?: string; meal?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const today = logicalDateKey(new Date(), user.profile?.timezone ?? "America/Sao_Paulo", user.profile?.dayClosesAtMinutes ?? 0);
  const date = params.date && parseLogicalDate(params.date) ? params.date : today;
  const day = await findDiaryDay(user.id, parseLogicalDate(date)!);
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
          carbohydrateGrams: entry.snapshotCarbohydrate === null ? null : Number(entry.snapshotCarbohydrate),
          fatGrams: entry.snapshotFat === null ? null : Number(entry.snapshotFat),
          macrosComplete: entry.macrosComplete,
          revisions: entry.revisions.map((revision) => ({
            id: revision.id,
            previousQuantity: Number(revision.previousQuantity),
            nextQuantity: Number(revision.nextQuantity),
            reason: revision.reason,
            correctedAt: revision.correctedAt.toISOString(),
          })),
        })),
      }))
    : STANDARD_MEALS.map((meal) => ({ id: null, slug: meal.slug, label: meal.label, custom: false, entries: [] }));

  return (
    <main className="shell py-8">
      <p className="eyebrow">Registro alimentar</p>
      <h1 className="display mt-2 text-4xl font-bold">Registre o que aconteceu.</h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl leading-7 text-[#657168]">Busque alimentos, use o scanner ou faça um lançamento rápido sem misturar o diário com o plano prescrito.</p>
        <Link className="button-secondary" href={`/dieta?date=${date}`}>Ver dieta do dia</Link>
      </div>
      <DiaryClient key={date} date={date} today={today} userScope={user.id} meals={meals} initialBarcode={params.barcode?.slice(0, 14)} initialScanner={params.scanner === "1"} initialMealSlug={params.meal?.slice(0, 80)} />
    </main>
  );
}
