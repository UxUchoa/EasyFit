import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import type { UserRole } from '@prisma/client';

type MockSession = { id: string; userId: string; reauthenticatedAt: Date | null; user: { id: string; username: string; onboardingDone: boolean; role: UserRole; profile: null } };
const authState = vi.hoisted(() => ({ session: null as MockSession | null }));
vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return { ...actual, getCurrentSession: async () => authState.session };
});

import { PATCH as patchEntry } from '@/app/api/entries/[id]/route';
import { DELETE as deletePrivateFood } from '@/app/api/private-foods/[id]/route';
import { DELETE as deleteMeasurement } from '@/app/api/measurements/[id]/route';
import { POST as substituteExercise } from '@/app/api/workout-sessions/[id]/exercises/[exerciseId]/substitute/route';
import { POST as createImport } from '@/app/api/imports/route';
import { PATCH as reviewImport } from '@/app/api/imports/[id]/items/[itemId]/route';
import { POST as confirmImport } from '@/app/api/imports/[id]/confirm/route';
import { POST as grantSupportAccess } from '@/app/api/admin/support-access/route';
import { GET as readSupportSummary } from '@/app/api/admin/support-access/[id]/summary/route';
import { DELETE as revokeSupportAccess } from '@/app/api/admin/support-access/[id]/route';
import { POST as createMealEntry } from '@/app/api/days/[date]/entries/route';
import { foodConflictKey } from '@/lib/catalog/conflicts';

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;

async function createEntry(userId: string) {
  const day = await db.dayLog.create({ data: { userId, logicalDate: new Date('2026-07-22T00:00:00.000Z'), timezone: 'America/Sao_Paulo' } });
  const meal = await db.meal.create({ data: { dayLogId: day.id, kind: 'LUNCH', slug: 'almoco', position: 2 } });
  return db.mealEntry.create({ data: { mealId: meal.id, kind: 'CONSUMED', quantity: 100, unit: 'g', snapshotName: 'Arroz', snapshotSource: 'TEST', snapshotCalories: 130, snapshotProtein: 2.5, snapshotCarbohydrate: 28, snapshotFat: 0.3, macrosComplete: true } });
}

function mutation(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
}

suite('PostgreSQL object ownership', () => {
  let userAId = '';
  let userBId = '';
  let entryAId = '';
  let entryBId = '';
  let foodBId = '';
  let measurementBId = '';
  let workoutBId = '';
  let sessionExerciseBId = '';
  let replacementExerciseId = '';
  let catalogExerciseIds: string[] = [];
  let userAUsername = '';
  let userBUsername = '';
  let conflictFoodIds: string[] = [];

  beforeAll(async () => {
    process.env.APP_URL = 'http://localhost:3000';
    const suffix = randomUUID().slice(0, 8);
    const [userA, userB] = await Promise.all([
      db.user.create({ data: { username: `idor-a-${suffix}`, passwordHash: 'integration-only', role: 'SUPPORT' } }),
      db.user.create({ data: { username: `idor-b-${suffix}`, passwordHash: 'integration-only' } }),
    ]);
    userAId = userA.id; userBId = userB.id; userAUsername = userA.username; userBUsername = userB.username;
    const [originalExercise, replacementExercise] = await Promise.all([
      db.exercise.create({ data: { name: 'Supino IDOR ' + suffix, muscleGroup: 'Peito', equipment: 'Peso corporal' } }),
      db.exercise.create({ data: { name: 'Flexão IDOR ' + suffix, muscleGroup: 'Peito', equipment: 'Peso corporal' } }),
    ]);
    replacementExerciseId = replacementExercise.id;
    catalogExerciseIds = [originalExercise.id, replacementExercise.id];
    const [entryA, entryB, foodB, measurementB] = await Promise.all([
      createEntry(userAId),
      createEntry(userBId),
      db.food.create({ data: { ownerId: userBId, name: 'Privado B', source: 'PRIVATE', baseQuantity: 100, baseUnit: 'g', calories: 100 } }),
      db.bodyMeasurement.create({ data: { userId: userBId, measuredAt: new Date('2026-07-22T00:00:00.000Z'), weightKg: 70 } }),
    ]);
    entryAId = entryA.id; entryBId = entryB.id; foodBId = foodB.id; measurementBId = measurementB.id;
    const workoutB = await db.workoutSession.create({ data: { userId: userBId, status: 'IN_PROGRESS', name: 'Treino privado B', startedAt: new Date(), exercises: { create: { exerciseId: originalExercise.id, position: 0, nameSnapshot: originalExercise.name, muscleSnapshot: originalExercise.muscleGroup, equipmentSnapshot: originalExercise.equipment, targetSets: 3, targetReps: '8-12', restSeconds: 60 } } }, include: { exercises: true } });
    workoutBId = workoutB.id;
    sessionExerciseBId = workoutB.exercises[0].id;
    authState.session = { id: 'session-a', userId: userAId, reauthenticatedAt: new Date(), user: { id: userAId, username: userA.username, onboardingDone: true, role: 'SUPPORT', profile: null } };
  });

  afterAll(async () => {
    authState.session = null;
    if (userAId || userBId) await db.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } });
    if (catalogExerciseIds.length) await db.exercise.deleteMany({ where: { id: { in: catalogExerciseIds } } });
    if (conflictFoodIds.length) await db.food.deleteMany({ where: { id: { in: conflictFoodIds } } });
    await db.$disconnect();
  });

  it('does not reveal or alter another users diary entry', async () => {
    const response = await patchEntry(mutation(`/api/entries/${entryBId}`, 'PATCH', { quantity: 250 }), { params: Promise.resolve({ id: entryBId }) });
    expect(response.status).toBe(404);
    const untouched = await db.mealEntry.findUniqueOrThrow({ where: { id: entryBId } });
    expect(Number(untouched.quantity)).toBe(100);
  });

  it('allows the same mutation for the owning user', async () => {
    const response = await patchEntry(mutation(`/api/entries/${entryAId}`, 'PATCH', { quantity: 150, reason: 'Correção de teste' }), { params: Promise.resolve({ id: entryAId }) });
    expect(response.status).toBe(200);
    const updated = await db.mealEntry.findUniqueOrThrow({ where: { id: entryAId } });
    expect(Number(updated.quantity)).toBe(150);
    expect(Number(updated.snapshotCalories)).toBe(195);
    const revision = await db.mealEntryRevision.findFirstOrThrow({ where: { mealEntryId: entryAId }, orderBy: { correctedAt: 'desc' } });
    expect(Number(revision.previousQuantity)).toBe(100);
    expect(Number(revision.nextQuantity)).toBe(150);
    expect(await db.mealEntry.count({ where: { id: entryAId } })).toBe(1);
  });

  it('detects a stale offline edit without overwriting or creating a false revision', async () => {
    const current = await db.mealEntry.findUniqueOrThrow({ where: { id: entryAId } });
    const accepted = await patchEntry(mutation(`/api/entries/${entryAId}`, 'PATCH', { quantity: 160, reason: 'Sincronização válida', expectedUpdatedAt: current.updatedAt.toISOString() }), { params: Promise.resolve({ id: entryAId }) });
    expect(accepted.status).toBe(200);
    const stale = await patchEntry(mutation(`/api/entries/${entryAId}`, 'PATCH', { quantity: 170, reason: 'Edição offline antiga', expectedUpdatedAt: current.updatedAt.toISOString() }), { params: Promise.resolve({ id: entryAId }) });
    expect(stale.status).toBe(409);
    const body = await stale.json() as { conflict: { server: { quantity: number }; client: { quantity: number } } };
    expect(body.conflict.server.quantity).toBe(160);
    expect(body.conflict.client.quantity).toBe(170);
    const preserved = await db.mealEntry.findUniqueOrThrow({ where: { id: entryAId } });
    expect(Number(preserved.quantity)).toBe(160);
    expect(await db.mealEntryRevision.count({ where: { mealEntryId: entryAId } })).toBe(2);
  });

  it('does not reveal or delete another users private food', async () => {
    const response = await deletePrivateFood(mutation(`/api/private-foods/${foodBId}`, 'DELETE'), { params: Promise.resolve({ id: foodBId }) });
    expect(response.status).toBe(404);
    expect(await db.food.findUnique({ where: { id: foodBId } })).not.toBeNull();
  });

  it('does not reveal or delete another users body measurement', async () => {
    const response = await deleteMeasurement(mutation('/api/measurements/' + measurementBId, 'DELETE'), { params: Promise.resolve({ id: measurementBId }) });
    expect(response.status).toBe(404);
    expect(await db.bodyMeasurement.findUnique({ where: { id: measurementBId } })).not.toBeNull();
  });

  it('does not reveal or substitute another users session exercise', async () => {
    const response = await substituteExercise(mutation('/api/workout-sessions/' + workoutBId + '/exercises/' + sessionExerciseBId + '/substitute', 'POST', { replacementExerciseId, reason: 'PREFERENCE' }), { params: Promise.resolve({ id: workoutBId, exerciseId: sessionExerciseBId }) });
    expect(response.status).toBe(404);
    const untouched = await db.workoutSessionExercise.findUniqueOrThrow({ where: { id: sessionExerciseBId } });
    expect(untouched.exerciseId).toBe(catalogExerciseIds[0]);
  });

  it('isolates import review and confirms the resulting diet only once', async () => {
    const content = JSON.stringify({ name: 'Dieta IDOR', days: [{ label: 'Segunda', meals: [{ name: 'Almoço', items: [{ food: 'Item não catalogado' }] }] }] });
    const createdResponse = await createImport(mutation('/api/imports', 'POST', { filename: 'dieta.json', mimeType: 'application/json', content }));
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { job: { id: string; items: Array<{ id: string }> } };
    const jobId = created.job.id;
    const itemId = created.job.items[0].id;

    authState.session = { id: 'session-b', userId: userBId, reauthenticatedAt: new Date(), user: { id: userBId, username: userBUsername, onboardingDone: true, role: 'USER', profile: null } };
    const denied = await reviewImport(mutation(`/api/imports/${jobId}/items/${itemId}`, 'PATCH', { decision: 'IGNORE' }), { params: Promise.resolve({ id: jobId, itemId }) });
    expect(denied.status).toBe(404);

    authState.session = { id: 'session-a', userId: userAId, reauthenticatedAt: new Date(), user: { id: userAId, username: userAUsername, onboardingDone: true, role: 'SUPPORT', profile: null } };
    const reviewed = await reviewImport(mutation(`/api/imports/${jobId}/items/${itemId}`, 'PATCH', { decision: 'MANUAL', name: 'Banana', quantity: 1, unit: 'un' }), { params: Promise.resolve({ id: jobId, itemId }) });
    expect(reviewed.status).toBe(200);
    const firstConfirmation = await confirmImport(mutation(`/api/imports/${jobId}/confirm`, 'POST', {}), { params: Promise.resolve({ id: jobId }) });
    const repeatedConfirmation = await confirmImport(mutation(`/api/imports/${jobId}/confirm`, 'POST', {}), { params: Promise.resolve({ id: jobId }) });
    expect(firstConfirmation.status).toBe(200);
    expect(repeatedConfirmation.status).toBe(200);
    expect(await db.dietPlan.count({ where: { sourceImportJobId: jobId } })).toBe(1);
    const plan = await db.dietPlan.findUniqueOrThrow({ where: { sourceImportJobId: jobId }, include: { versions: true } });
    expect(plan.userId).toBe(userAId);
    expect(plan.versions).toHaveLength(1);
  });

  it('enforces staff RBAC, scoped consultation records and immediate revocation', async () => {
    const targetJob = await db.importJob.create({ data: { userId: userBId, status: 'REVIEW', originalFilename: 'target.json', mimeType: 'application/json', byteSize: 100, contentSha256: 'a'.repeat(64), sourcePayload: { name: 'Target', days: [] }, parserVersion: 'integration', attemptCount: 1 } });
    authState.session = { id: 'session-b', userId: userBId, reauthenticatedAt: new Date(), user: { id: userBId, username: userBUsername, onboardingDone: true, role: 'USER', profile: null } };
    const hidden = await grantSupportAccess(mutation('/api/admin/support-access', 'POST', { username: userBUsername, reason: 'Tentativa de acesso sem papel interno', scopes: ['ACCOUNT_METADATA'] }));
    expect(hidden.status).toBe(404);

    authState.session = { id: 'session-a', userId: userAId, reauthenticatedAt: new Date(), user: { id: userAId, username: userAUsername, onboardingDone: true, role: 'SUPPORT', profile: null } };
    const grantedResponse = await grantSupportAccess(mutation('/api/admin/support-access', 'POST', { username: userBUsername, reason: 'Investigar falha informada pelo titular da conta', scopes: ['ACCOUNT_METADATA', 'IMPORT_STATUS'] }));
    expect(grantedResponse.status).toBe(201);
    const granted = await grantedResponse.json() as { access: { id: string } };
    const summaryResponse = await readSupportSummary(new Request('http://localhost:3000/api/admin/support-access/' + granted.access.id + '/summary'), { params: Promise.resolve({ id: granted.access.id }) });
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json() as { account: { username: string }; imports: Array<{ id: string }> };
    expect(summary.account.username).toBe(userBUsername);
    expect(summary.imports.some((job) => job.id === targetJob.id)).toBe(true);
    expect(await db.supportAccessObject.count({ where: { supportAccessId: granted.access.id } })).toBe(2);

    const revoked = await revokeSupportAccess(mutation('/api/admin/support-access/' + granted.access.id, 'DELETE'), { params: Promise.resolve({ id: granted.access.id }) });
    expect(revoked.status).toBe(200);
    const afterRevocation = await readSupportSummary(new Request('http://localhost:3000/api/admin/support-access/' + granted.access.id + '/summary'), { params: Promise.resolve({ id: granted.access.id }) });
    expect(afterRevocation.status).toBe(404);
  });

  it('records a source choice per user without overwriting catalog alternatives', async () => {
    const suffix = randomUUID().slice(0, 8);
    const [taco, usda] = await Promise.all([
      db.food.create({ data: { name: 'Arroz conflito ' + suffix, source: 'TACO', baseQuantity: 100, baseUnit: 'g', calories: 130, proteinGrams: 2.5, carbohydrateGrams: 28, fatGrams: 0.3 } }),
      db.food.create({ data: { name: 'Arroz conflito ' + suffix, source: 'USDA', baseQuantity: 100, baseUnit: 'g', calories: 125, proteinGrams: 2.7, carbohydrateGrams: 27, fatGrams: 0.4 } }),
    ]);
    conflictFoodIds = [taco.id, usda.id];
    const conflictKey = foodConflictKey(taco);
    authState.session = { id: 'session-a', userId: userAId, reauthenticatedAt: new Date(), user: { id: userAId, username: userAUsername, onboardingDone: true, role: 'SUPPORT', profile: null } };
    const forged = await createMealEntry(mutation('/api/days/2026-07-22/entries', 'POST', { mealSlug: 'almoco', kind: 'CONSUMED', foodId: taco.id, sourceConflictKey: 'name:forged', quantity: 100, unit: 'g' }), { params: Promise.resolve({ date: '2026-07-22' }) });
    expect(forged.status).toBe(400);
    const first = await createMealEntry(mutation('/api/days/2026-07-22/entries', 'POST', { mealSlug: 'almoco', kind: 'CONSUMED', foodId: taco.id, sourceConflictKey: conflictKey, quantity: 100, unit: 'g' }), { params: Promise.resolve({ date: '2026-07-22' }) });
    const second = await createMealEntry(mutation('/api/days/2026-07-22/entries', 'POST', { mealSlug: 'almoco', kind: 'CONSUMED', foodId: usda.id, sourceConflictKey: conflictKey, quantity: 100, unit: 'g' }), { params: Promise.resolve({ date: '2026-07-22' }) });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const choices = await db.foodSourceChoice.findMany({ where: { userId: userAId, conflictKey } });
    expect(choices).toHaveLength(1);
    expect(choices[0].selectedFoodId).toBe(usda.id);
    expect(choices[0].selectedSnapshotSource).toBe('USDA');
    expect(await db.foodSourceChoice.count({ where: { userId: userBId } })).toBe(0);
    expect(await db.food.count({ where: { id: { in: conflictFoodIds } } })).toBe(2);
  });

  it('enforces append-only audit records in PostgreSQL', async () => {
    const event = await db.auditEvent.create({ data: { actorUserId: userAId, action: 'integration.immutable', objectType: 'Test', objectId: randomUUID(), result: 'SUCCESS', correlationId: randomUUID() } });
    await expect(db.auditEvent.update({ where: { id: event.id }, data: { result: 'FAILURE' } })).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
    expect(await db.auditEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
  });
});
