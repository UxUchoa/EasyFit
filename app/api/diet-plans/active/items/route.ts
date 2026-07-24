import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { calculateEntryNutrition } from "@/lib/diary/nutrition";
import { appendDietPlanSnapshotItem, dietPlanSnapshotSchema, removeDietPlanSnapshotItem, replaceDietPlanSnapshotFood, updateDietPlanSnapshotItem, type DietPlanSnapshot, type DietPlanSnapshotItem } from "@/lib/imports/snapshot";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const pointerSchema = z.string().trim().min(1).max(500);
const patchSchema = z.object({
  sourcePointer: pointerSchema,
  name: z.string().trim().min(1).max(180),
  quantity: z.coerce.number().positive().max(100_000),
  unit: z.string().trim().min(1).max(24),
}).strict();
const deleteSchema = z.object({ sourcePointer: pointerSchema }).strict();
const postSchema = z.object({
  dayLabel: z.string().trim().min(1).max(80),
  mealLabel: z.string().trim().min(1).max(80),
  foodId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(180).optional(),
  quantity: z.coerce.number().positive().max(100_000),
  unit: z.string().trim().min(1).max(24),
}).strict();

async function activeVersion(userId: string) {
  const plan = await db.dietPlan.findFirst({
    where: { userId, active: true },
    select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, snapshot: true } } },
  });
  const version = plan?.versions[0];
  if (!plan || !version) return null;
  const snapshot = dietPlanSnapshotSchema.safeParse(version.snapshot);
  return snapshot.success ? { plan, version, snapshot: snapshot.data } : null;
}

async function accessibleFood(userId: string, foodId: string) {
  return db.food.findFirst({
    where: { id: foodId, OR: [{ ownerId: null }, { ownerId: userId }], source: { not: "FATSECRET" } },
    include: { portions: true },
  });
}

function foodForCalculation(food: NonNullable<Awaited<ReturnType<typeof accessibleFood>>>) {
  return {
    id: food.id,
    name: food.name,
    source: food.source,
    baseQuantity: Number(food.baseQuantity),
    baseUnit: food.baseUnit,
    calories: Number(food.calories),
    proteinGrams: food.proteinGrams === null ? null : Number(food.proteinGrams),
    carbohydrateGrams: food.carbohydrateGrams === null ? null : Number(food.carbohydrateGrams),
    fatGrams: food.fatGrams === null ? null : Number(food.fatGrams),
    portions: food.portions.map((portion) => ({ name: portion.name, unit: portion.unit, quantityInBaseUnit: Number(portion.quantityInBaseUnit) })),
  };
}

function itemResponse(item: DietPlanSnapshotItem) {
  return {
    sourcePointer: item.sourcePointer,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.nutrition?.calories ?? null,
    proteinGrams: item.nutrition?.proteinGrams ?? null,
    carbohydrateGrams: item.nutrition?.carbohydrateGrams ?? null,
    fatGrams: item.nutrition?.fatGrams ?? null,
    source: item.catalog?.source ?? null,
  };
}

async function saveSnapshot(userId: string, planId: string, versionId: string, snapshot: DietPlanSnapshot, action: string, context: Record<string, string | number | null>) {
  await db.$transaction(async (transaction) => {
    await transaction.dietPlanVersion.update({ where: { id: versionId }, data: { snapshot } });
    await transaction.auditEvent.create({ data: { actorUserId: userId, action, objectType: "DietPlanVersion", objectId: versionId, result: "SUCCESS", correlationId: randomUUID(), context: { planId, ...context } } });
  });
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const input = patchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Revise o nome, a quantidade e a unidade." }, { status: 400 });
  const active = await activeVersion(session.userId);
  if (!active) return NextResponse.json({ error: "Nenhuma dieta ativa compatível foi encontrada." }, { status: 404 });
  const original = active.snapshot.items.find((item) => item.sourcePointer === input.data.sourcePointer);
  if (!original) return NextResponse.json({ error: "O item da dieta não foi encontrado." }, { status: 404 });

  let updated = updateDietPlanSnapshotItem(active.snapshot, original.sourcePointer, { name: input.data.name, quantity: input.data.quantity, unit: input.data.unit });
  if (!updated) return NextResponse.json({ error: "O item da dieta não foi encontrado." }, { status: 404 });
  if (original.catalog?.foodId) {
    const food = await accessibleFood(session.userId, original.catalog.foodId);
    if (food) updated = replaceDietPlanSnapshotFood(updated, original.sourcePointer, foodForCalculation(food));
    else if (original.nutrition && input.data.unit === original.unit) {
      const factor = input.data.quantity / original.quantity;
      updated = updateDietPlanSnapshotItem(updated, original.sourcePointer, { nutrition: {
        calories: original.nutrition.calories * factor,
        proteinGrams: original.nutrition.proteinGrams === null ? null : original.nutrition.proteinGrams * factor,
        carbohydrateGrams: original.nutrition.carbohydrateGrams === null ? null : original.nutrition.carbohydrateGrams * factor,
        fatGrams: original.nutrition.fatGrams === null ? null : original.nutrition.fatGrams * factor,
      } });
    } else if (input.data.unit !== original.unit) return NextResponse.json({ error: "Revise o alimento antes de alterar para uma unidade diferente." }, { status: 409 });
  } else if (original.nutrition && input.data.unit === original.unit) {
    const factor = input.data.quantity / original.quantity;
    updated = updateDietPlanSnapshotItem(updated, original.sourcePointer, { nutrition: {
      calories: original.nutrition.calories * factor,
      proteinGrams: original.nutrition.proteinGrams === null ? null : original.nutrition.proteinGrams * factor,
      carbohydrateGrams: original.nutrition.carbohydrateGrams === null ? null : original.nutrition.carbohydrateGrams * factor,
      fatGrams: original.nutrition.fatGrams === null ? null : original.nutrition.fatGrams * factor,
    } });
  } else if (input.data.unit !== original.unit) {
    return NextResponse.json({ error: "Revise o alimento antes de alterar para uma unidade diferente." }, { status: 409 });
  }
  if (!updated) return NextResponse.json({ error: "A unidade escolhida não possui equivalência nutricional." }, { status: 409 });
  const item = updated.items.find((candidate) => candidate.sourcePointer === original.sourcePointer)!;
  await saveSnapshot(session.userId, active.plan.id, active.version.id, updated, "diet_plan.item.update", { sourcePointer: original.sourcePointer, previousName: original.name, name: item.name, quantity: item.quantity, unit: item.unit });
  return NextResponse.json({ item: itemResponse(item) });
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const input = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Item inválido." }, { status: 400 });
  const active = await activeVersion(session.userId);
  if (!active) return NextResponse.json({ error: "Nenhuma dieta ativa compatível foi encontrada." }, { status: 404 });
  const original = active.snapshot.items.find((item) => item.sourcePointer === input.data.sourcePointer);
  const updated = removeDietPlanSnapshotItem(active.snapshot, input.data.sourcePointer);
  if (!original || !updated) return NextResponse.json({ error: "O item da dieta não foi encontrado." }, { status: 404 });
  await saveSnapshot(session.userId, active.plan.id, active.version.id, updated, "diet_plan.item.delete", { sourcePointer: original.sourcePointer, name: original.name });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const input = postSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Revise o alimento, a quantidade e a unidade." }, { status: 400 });
  const [active, food] = await Promise.all([activeVersion(session.userId), accessibleFood(session.userId, input.data.foodId)]);
  if (!active) return NextResponse.json({ error: "Nenhuma dieta ativa compatível foi encontrada." }, { status: 404 });
  if (!food) return NextResponse.json({ error: "O alimento selecionado não está disponível." }, { status: 404 });
  const calculationFood = foodForCalculation(food);
  const nutrition = calculateEntryNutrition(calculationFood, input.data.quantity, input.data.unit);
  if (!nutrition) return NextResponse.json({ error: `A unidade “${input.data.unit}” não é compatível com este alimento.` }, { status: 409 });
  const item: DietPlanSnapshotItem = {
    day: input.data.dayLabel,
    meal: input.data.mealLabel,
    name: input.data.name ?? food.name,
    quantity: input.data.quantity,
    unit: input.data.unit,
    sourcePointer: `$.manual[${randomUUID()}]`,
    catalog: { foodId: food.id, name: food.name, source: food.source, confidence: 1 },
    nutrition,
  };
  const updated = appendDietPlanSnapshotItem(active.snapshot, item)!;
  await saveSnapshot(session.userId, active.plan.id, active.version.id, updated, "diet_plan.item.create", { sourcePointer: item.sourcePointer, name: item.name, meal: item.meal, quantity: item.quantity, unit: item.unit });
  return NextResponse.json({ item: itemResponse(item) }, { status: 201 });
}
