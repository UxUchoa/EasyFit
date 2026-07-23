import { createHash, randomUUID } from 'node:crypto';
import type { ImportItemDecision, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { calculateEntryNutrition } from '@/lib/diary/nutrition';
import { assertImportTransition, dietImportSchema, flattenImportItems, IMPORT_PARSER_VERSION, reviewBlockingReason, validateJsonUpload } from './domain';
import { extractDeclaredCalories, normalizeFoodName, resolveImportFoodNames } from './food-resolver';

async function extractedItems(userId: string, payload: Prisma.JsonValue) {
  const parsed = dietImportSchema.parse(payload);
  const flat = flattenImportItems(parsed);
  if (flat.length > 1_000) throw new Error('A importação pode conter no máximo 1.000 itens.');
  const resolved = await resolveImportFoodNames(userId, flat.map((item) => item.extractedName));
  return flat.map((item) => {
    const match = resolved.get(normalizeFoodName(item.extractedName));
    const complete = item.extractedQuantity !== null && item.extractedUnit !== null;
    return {
      ...item,
      matchedFoodId: match?.foodId ?? null,
      matchedFoodName: match?.name ?? null,
      matchedFoodSource: match?.source ?? null,
      matchConfidence: match?.confidence ?? null,
      decision: match && complete ? 'KEEP' as const : 'PENDING' as const,
    };
  });
}

export async function createJsonImport(userId: string, input: { filename: string; mimeType: string; content: string }) {
  const validated = validateJsonUpload(input);
  const contentSha256 = createHash('sha256').update(input.content, 'utf8').digest('hex');
  const job = await db.$transaction(async (transaction) => {
    const created = await transaction.importJob.create({ data: {
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
    return transaction.importJob.update({ where: { id: created.id }, data: { status: 'PROCESSING', startedAt: new Date(), attemptCount: 1 } });
  });
  try {
    const items = await extractedItems(userId, validated.data);
    return await db.$transaction(async (transaction) => {
      await transaction.importItem.createMany({ data: items.map((item) => ({ importJobId: job.id, ...item })) });
      assertImportTransition('PROCESSING', 'REVIEW');
      const ready = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'REVIEW', reviewReadyAt: new Date() }, include: { items: { orderBy: { position: 'asc' } } } });
      await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.received', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { mimeType: job.mimeType, byteSize: job.byteSize, itemCount: items.length, autoMatchedCount: items.filter((item) => item.decision === 'KEEP').length, uniqueFoodCount: new Set(items.map((item) => normalizeFoodName(item.extractedName))).size, parserVersion: job.parserVersion } } });
      return ready;
    });
  } catch (error) {
    await db.importJob.update({ where: { id: job.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message.slice(0, 500) : 'Falha ao resolver os alimentos.' } }).catch(() => undefined);
    throw error;
  }
}

export async function reprocessImport(userId: string, importJobId: string) {
  const job = await db.$transaction(async (transaction) => {
    const job = await transaction.importJob.findFirst({ where: { id: importJobId, userId } });
    if (!job) throw new Error('Importação não encontrada.');
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') throw new Error('Esta importação não pode ser reprocessada.');
    assertImportTransition(job.status, 'PROCESSING');
    return transaction.importJob.update({ where: { id: job.id }, data: { status: 'PROCESSING', startedAt: new Date(), failureReason: null, attemptCount: { increment: 1 } } });
  });
  try {
    const items = await extractedItems(userId, job.sourcePayload);
    return await db.$transaction(async (transaction) => {
      await transaction.importItem.deleteMany({ where: { importJobId: job.id } });
      await transaction.importItem.createMany({ data: items.map((item) => ({ importJobId: job.id, ...item })) });
      assertImportTransition('PROCESSING', 'REVIEW');
      const ready = await transaction.importJob.update({ where: { id: job.id }, data: { status: 'REVIEW', reviewReadyAt: new Date() }, include: { items: { orderBy: { position: 'asc' } } } });
      await transaction.auditEvent.create({ data: { actorUserId: userId, action: 'diet_import.reprocessed', objectType: 'ImportJob', objectId: job.id, result: 'SUCCESS', correlationId: randomUUID(), context: { attemptCount: ready.attemptCount, itemCount: items.length, autoMatchedCount: items.filter((item) => item.decision === 'KEEP').length, parserVersion: job.parserVersion } } });
      return ready;
    });
  } catch (error) {
    await db.importJob.update({ where: { id: job.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message.slice(0, 500) : 'Falha ao resolver os alimentos.' } }).catch(() => undefined);
    throw error;
  }
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
    const matchedFoodIds = job.items.flatMap((item) => item.matchedFoodId ? [item.matchedFoodId] : []);
    const matchedFoods = matchedFoodIds.length ? await transaction.food.findMany({ where: { id: { in: matchedFoodIds }, OR: [{ ownerId: null }, { ownerId: userId }] }, include: { portions: true } }) : [];
    const foodById = new Map(matchedFoods.map((food) => [food.id, food]));
    const snapshot = {
      importJobId: job.id,
      parserVersion: job.parserVersion,
      ignoredCount,
      items: job.items.filter((item) => item.decision !== 'IGNORE').map((item) => {
        const quantity = Number(item.reviewedQuantity ?? item.extractedQuantity);
        const unit = item.reviewedUnit ?? item.extractedUnit!;
        const food = item.decision === 'MANUAL' || !item.matchedFoodId ? null : foodById.get(item.matchedFoodId);
        const nutrients = food ? calculateEntryNutrition({
          baseQuantity: Number(food.baseQuantity), baseUnit: food.baseUnit, calories: Number(food.calories),
          proteinGrams: food.proteinGrams === null ? null : Number(food.proteinGrams),
          carbohydrateGrams: food.carbohydrateGrams === null ? null : Number(food.carbohydrateGrams),
          fatGrams: food.fatGrams === null ? null : Number(food.fatGrams),
          portions: food.portions.map((portion) => ({ name: portion.name, unit: portion.unit, quantityInBaseUnit: Number(portion.quantityInBaseUnit) })),
        }, quantity, unit) : null;
        const declaredCalories = extractDeclaredCalories(item.extractedName);
        const nutrition = nutrients ?? (declaredCalories === null ? null : { calories: declaredCalories * quantity, proteinGrams: null, carbohydrateGrams: null, fatGrams: null });
        return {
          day: item.dayLabel,
          meal: item.mealLabel,
          name: item.reviewedName ?? item.extractedName,
          quantity,
          unit,
          sourcePointer: item.sourcePointer,
          catalog: item.matchedFoodId ? { foodId: item.matchedFoodId, name: item.matchedFoodName, source: item.matchedFoodSource, confidence: item.matchConfidence ? Number(item.matchConfidence) : null } : null,
          nutrition,
        };
      }),
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
