import type { Metadata } from 'next';
import { ContextualHelp } from '@/components/contextual-help';
import { ImportManager } from '@/components/import-manager';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Importar dieta' };

export default async function ImportsPage() {
  const user = await requireUser();
  const jobs = await db.importJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { items: { orderBy: { position: 'asc' } }, dietPlan: true },
  });
  return <main className='shell py-8'>
    <p className='eyebrow'>Importação de dieta</p>
    <h1 className='display mt-2 text-4xl font-bold'>Receba, revise, só então ative.</h1>
    <p className='mt-3 max-w-2xl leading-7 text-[#657168]'>O piloto aceita JSON estruturado de até 2 MB. Nenhuma porção ausente é inventada e nenhum plano entra em uso sem sua confirmação.</p>
    <ContextualHelp href='/dieta' linkLabel='Voltar ao diário alimentar'>Use um arquivo JSON com dias, refeições e itens. Se houver quantidade ausente ou correspondência incerta, revise o item nesta tela antes de confirmar; cancelar não altera seu diário atual.</ContextualHelp>
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
      items: job.items.map((item) => ({
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
      })),
    }))} />
  </main>;
}
