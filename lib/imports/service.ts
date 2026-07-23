import { createHash, randomUUID } from 'node:crypto';
import type { ImportItemDecision, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { assertImportTransition, dietImportSchema, flattenImportItems, IMPORT_PARSER_VERSION, reviewBlockingReason, validateJsonUpload } from './domain';

type Transaction = Prisma.TransactionClient;

function normalizedName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
}

async function extractedItems(transaction: Transaction, userId: string, payload: Prisma.JsonValue) {
  const parsed = dietImportSchema.parse(payload);
  const flat = flattenImportItems(parsed);
  if (flat.length > 1_000) throw new Error('A importação pode conter no máximo 1.000 itens.');
  const names = [...new Set(flat.map((item) => item.extractedName))];
  const foods = await transaction.food.findMany({
    where: { AND: [{ OR: [{ ownerId: null }, { ownerId: userId }] }, { OR: names.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })) }] },
    select: { id: true, name: true, source: true },
  });
  const byName = new Map(foods.map((food) => [normalizedName(food.name), food]));
  return flat.map((item) => {
    const match = byName.get(normalizedName(item.extractedName));
    const complete = item.extractedQuantity !== null && item.extractedUnit !== null;
    return {
      ...item,
      matchedFoodId: match?.id ?? null,
      matchedFoodName: match?.name ?? null,
      matchedFoodSource: match?.source ?? null,
      matchConfidence: match ? 1 : null,
      decision: match && complete ? 'KEEP' as const : 'PENDING' as const,
    };
  });
}

export async function createJsonImport(userId: string, input: { filename: string; mimeType: string; content: string }) {
  const validated = validateJsonUpload(input);
  const contentSha256 = createHash('sha256').update(input.content, 'utf8').digest('hex');
  return db.$transaction(async (transaction) => {
    const job = await transaction.importJob.create({ data: {
      userId,
      status: 'PENDING',
      originalFilename: input.filename.trim(),
      mimeType: input.mimeType.toLowerCase(),
      byteSize: validated.byteSize,
      contentSha256,
      sourcePayload: validated.data,
      parserVersion: IMPORT_PARSER_VERSION,
    } });
    assertImportTransition('PENDING', 'PROCESSING');
    await transaction.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING', startedAt: new Date(), attemptCount: 1 } });
    const items = await extractedItems(transaction, userId, validated.data);
    await transaction.importItem.createMany({ data: items.map((item) => ({ importJobId: job.id, ...item })) });
    assertImportTransition('PROCESSING', 'REVIEW');
    const ready = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'REVIEW', reviewReadyAt: new Date() }, include: { items: { orderBy: { position: 'asc' } } } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.received', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { mimeType: job.mimeType, byteSize: job.byteSize, itemCount: items.length, parserVersion: job.parserVersion } } });
    return ready;
  });
}

export async function reprocessImport(userId: string, importJobId: string) {
  return db.$transaction(async (transaction) => {
    const job = await transaction.importJob.findFirst({ where: { id: importJobId, userId } });
    if (!job) throw new Error('Importação não encontrada.');
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') throw new Error('Esta importação não pode ser reprocessada.');
    assertImportTransition(job.status, 'PROCESSING');
    await transaction.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING', startedAt: new Date(), failureReason: null, attemptCount: { increment: 1 } } });
    const items = await extractedItems(transaction, userId, job.sourcePayload);
    await transaction.importItem.deleteMany({ where: { importJobId: job.id } });
    await transaction.importItem.createMany({ data: items.map((item) => ({ importJobId: job.id, ...item })) });
    assertImportTransition('PROCESSING', 'REVIEW');
    const ready = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'REVIEW', reviewReadyAt: new Date() }, include: { items: { orderBy: { position: 'asc' } } } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.reprocessed', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { attemptCount: ready.attemptCount, itemCount: items.length, parserVersion: job.parserVersion } } });
    return ready;
  });
}

export async function reviewImportItem(userId: string, importJobId: string, itemId: string, input: { decision: ImportItemDecision; name?: string | null; quantity?: number | null; unit?: string | null }) {
  return db.$transaction(async (transaction) => {
    const item = await transaction.importItem.findFirst({ where: { id: itemId, importJobId, importJob: { userId, status: 'REVIEW' } } });
    if (!item) throw new Error('Item de importação não encontrado para revisão.');
    const candidate = {
      ...item,
      decision: input.decision,
      reviewedName: input.name?.trim() || null,
      reviewedQuantity: input.quantity ?? null,
      reviewedUnit: input.unit?.trim() || null,
    };
    const blocking = reviewBlockingReason(candidate);
    if (input.decision !== 'PENDING' && blocking) throw new Error(blocking);
    const updated = await transaction.importItem.update({ where: { id: item.id }, data: { decision: input.decision, reviewedName: candidate.reviewedName, reviewedQuantity: candidate.reviewedQuantity, reviewedUnit: candidate.reviewedUnit, reviewedAt: new Date() } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.item_reviewed', objectType: 'ImportItem', objectId: item.id, result: 'SUCCESS', correlationId: randomUUID(), context: { importJobId, decision: input.decision } } });
    return updated;
  });
}

export async function confirmImport(userId: string, importJobId: string) {
  return db.$transaction(async (transaction) => {
    const job = await transaction.importJob.findFirst({ where: { id: importJobId, userId }, include: { items: { orderBy: { position: 'asc' } }, dietPlan: { include: { versions: true } } } });
    if (!job) throw new Error('Importação não encontrada.');
    if (job.status === 'COMPLETED' && job.dietPlan) return { job, plan: job.dietPlan, ignoredCount: job.items.filter((item) => item.decision === 'IGNORE').length };
    if (job.status !== 'REVIEW') throw new Error('A importação ainda não está pronta para confirmação.');
    const blocked = job.items.find((item) => reviewBlockingReason(item));
    if (blocked) throw new Error(`Revise o item ${blocked.position + 1}: ${reviewBlockingReason(blocked)}`);
    const parsed = dietImportSchema.parse(job.sourcePayload);
    const ignoredCount = job.items.filter((item) => item.decision === 'IGNORE').length;
    const snapshot = {
      importJobId: job.id,
      parserVersion: job.parserVersion,
      ignoredCount,
      items: job.items.filter((item) => item.decision !== 'IGNORE').map((item) => ({
        day: item.dayLabel,
        meal: item.mealLabel,
        name: item.reviewedName ?? item.matchedFoodName ?? item.extractedName,
        quantity: Number(item.reviewedQuantity ?? item.extractedQuantity),
        unit: item.reviewedUnit ?? item.extractedUnit,
        sourcePointer: item.sourcePointer,
        catalog: item.matchedFoodId ? { foodId: item.matchedFoodId, name: item.matchedFoodName, source: item.matchedFoodSource, confidence: item.matchConfidence ? Number(item.matchConfidence) : null } : null,
      })),
    };
    await transaction.dietPlan.updateMany({ where: { userId, active: true }, data: { active: false } });
    const plan = await transaction.dietPlan.create({ data: { userId, name: parsed.name, active: true, sourceImportJobId: job.id, versions: { create: { version: 1, snapshot, confirmedAt: new Date() } } }, include: { versions: true } });
    assertImportTransition('REVIEW', 'COMPLETED');
    const completed = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() }, include: { items: { orderBy: { position: 'asc' } }, dietPlan: { include: { versions: true } } } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.confirmed', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { planId: plan.id, itemCount: snapshot.items.length, ignoredCount, parserVersion: job.parserVersion } } });
    return { job: completed, plan, ignoredCount };
  }, { isolationLevel: 'Serializable' });
}

export async function cancelImport(userId: string, importJobId: string) {
  return db.$transaction(async (transaction) => {
    const job = await transaction.importJob.findFirst({ where: { id: importJobId, userId } });
    if (!job) throw new Error('Importação não encontrada.');
    assertImportTransition(job.status, 'CANCELLED');
    const cancelled = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.cancelled', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { previousStatus: job.status } } });
    return cancelled;
  });
}
