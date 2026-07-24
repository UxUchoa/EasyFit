import type { Metadata } from 'next';
import { ContextualHelp } from '@/components/contextual-help';
import { ImportManager } from '@/components/import-manager';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { calculateEntryNutrition } from '@/lib/diary/nutrition';
import { extractDeclaredCalories } from '@/lib/imports/food-resolver';

export const metadata: Metadata = { title: 'Importar dieta' };

export default async function ImportsPage() {
  const user = await requireUser();
  const jobs = await db.importJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { items: { orderBy: { position: 'asc' } }, dietPlan: true },
  });
  const matchedFoodIds = [...new Set(jobs.flatMap((job) => job.items.flatMap((item) => item.matchedFoodId ? [item.matchedFoodId] : [])))];
  const matchedFoods = matchedFoodIds.length ? await db.food.findMany({ where: { id: { in: matchedFoodIds }, OR: [{ ownerId: null }, { ownerId: user.id }] }, include: { portions: true } }) : [];
  const foodById = new Map(matchedFoods.map((food) => [food.id, food]));
  return <main className='shell py-8'>
    <p className='eyebrow'>Importação de dieta</p>
    <h1 className='display mt-2 text-4xl font-bold'>Receba, revise, só então ative.</h1>
    <p className='mt-3 max-w-2xl leading-7 text-[#657168]'>O piloto aceita JSON estruturado de até 2 MB. Nenhuma porção ausente é inventada e nenhum plano entra em uso sem sua confirmação.</p>
    <ContextualHelp href='/dieta' linkLabel='Voltar à dieta'>Use um arquivo JSON com dias, refeições e itens. Se houver quantidade ausente ou correspondência incerta, revise o item nesta tela antes de confirmar; cancelar não altera seu plano ativo.</ContextualHelp>
    <ImportManager jobs={jobs.map((job) => ({
      id: job.id,
      status: job.status,
      filename: job.originalFilename,
      byteSize: job.byteSize,
      parserVersion: job.parserVersion,
      attemptCount: job.attemptCount,
      failureReason: job.failureReason,
      createdAt: job.createdAt.toISOString(),
      reviewReadyAt: job.reviewReadyAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      plan: job.dietPlan ? { id: job.dietPlan.id, name: job.dietPlan.name, active: job.dietPlan.active } : null,
      items: job.items.map((item) => {
        const food = item.matchedFoodId ? foodById.get(item.matchedFoodId) : null;
        const quantity = Number(item.reviewedQuantity ?? item.extractedQuantity ?? 0);
        const unit = item.reviewedUnit ?? item.extractedUnit ?? '';
        const nutrition = food && quantity > 0 && unit ? calculateEntryNutrition({
          baseQuantity: Number(food.baseQuantity), baseUnit: food.baseUnit, calories: Number(food.calories),
          proteinGrams: food.proteinGrams === null ? null : Number(food.proteinGrams),
          carbohydrateGrams: food.carbohydrateGrams === null ? null : Number(food.carbohydrateGrams),
          fatGrams: food.fatGrams === null ? null : Number(food.fatGrams),
          portions: food.portions.map((portion) => ({ name: portion.name, unit: portion.unit, quantityInBaseUnit: Number(portion.quantityInBaseUnit) })),
        }, quantity, unit) : null;
        const declaredCalories = extractDeclaredCalories(item.extractedName);
        const estimate = nutrition ?? (declaredCalories === null ? null : { calories: declaredCalories * Math.max(1, quantity), proteinGrams: null, carbohydrateGrams: null, fatGrams: null });
        return {
        id: item.id,
        position: item.position,
        dayLabel: item.dayLabel,
        mealLabel: item.mealLabel,
        extractedName: item.extractedName,
        extractedQuantity: item.extractedQuantity?.toString() ?? null,
        extractedUnit: item.extractedUnit,
        sourcePointer: item.sourcePointer,
        confidence: Number(item.confidence),
        matchedFoodName: item.matchedFoodName,
        matchedFoodSource: item.matchedFoodSource,
        matchConfidence: item.matchConfidence ? Number(item.matchConfidence) : null,
        decision: item.decision,
        reviewedName: item.reviewedName,
        reviewedQuantity: item.reviewedQuantity?.toString() ?? null,
        reviewedUnit: item.reviewedUnit,
        estimatedCalories: estimate?.calories ?? null,
        estimatedProteinGrams: estimate?.proteinGrams ?? null,
        estimatedCarbohydrateGrams: estimate?.carbohydrateGrams ?? null,
        estimatedFatGrams: estimate?.fatGrams ?? null,
      };
      }),
    }))} />
  </main>;
}
