import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { dietPlanSnapshotSchema, replaceDietPlanSnapshotFood } from "@/lib/imports/snapshot";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const schema = z.object({
  sourcePointer: z.string().trim().min(1).max(500),
  foodId: z.string().trim().min(1).max(40),
}).strict();

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Seleção de alimento inválida." }, { status: 400 });

  const [plan, food] = await Promise.all([
    db.dietPlan.findFirst({
      where: { userId: session.userId, active: true },
      select: { id: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, snapshot: true } } },
    }),
    db.food.findFirst({
      where: { id: input.data.foodId, OR: [{ ownerId: null }, { ownerId: session.userId }], source: { not: "FATSECRET" } },
      include: { portions: true },
    }),
  ]);
  const version = plan?.versions[0];
  if (!plan || !version) return NextResponse.json({ error: "Nenhuma dieta ativa encontrada." }, { status: 404 });
  if (!food) return NextResponse.json({ error: "O alimento selecionado não está disponível." }, { status: 404 });
  const snapshot = dietPlanSnapshotSchema.safeParse(version.snapshot);
  if (!snapshot.success) return NextResponse.json({ error: "A versão ativa da dieta não possui dados compatíveis." }, { status: 409 });
  const original = snapshot.data.items.find((item) => item.sourcePointer === input.data.sourcePointer);
  if (!original) return NextResponse.json({ error: "O item da dieta não foi encontrado." }, { status: 404 });

  const updated = replaceDietPlanSnapshotFood(snapshot.data, input.data.sourcePointer, {
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
  });
  if (!updated) return NextResponse.json({ error: `A unidade “${original.unit}” não é compatível com este alimento. Escolha uma opção com porção equivalente.` }, { status: 409 });
  const item = updated.items.find((candidate) => candidate.sourcePointer === input.data.sourcePointer)!;

  await db.$transaction(async (transaction) => {
    await transaction.dietPlanVersion.update({ where: { id: version.id }, data: { snapshot: updated } });
    await transaction.auditEvent.create({ data: {
      actorUserId: session.userId,
      action: "diet_plan.item.review",
      objectType: "DietPlanVersion",
      objectId: version.id,
      result: "SUCCESS",
      correlationId: randomUUID(),
      context: { planId: plan.id, sourcePointer: input.data.sourcePointer, originalName: original.name, selectedFoodId: food.id, selectedFoodName: food.name, selectedSource: food.source },
    } });
  });

  return NextResponse.json({ item: {
    sourcePointer: item.sourcePointer,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.nutrition?.calories ?? null,
    proteinGrams: item.nutrition?.proteinGrams ?? null,
    carbohydrateGrams: item.nutrition?.carbohydrateGrams ?? null,
    fatGrams: item.nutrition?.fatGrams ?? null,
    source: item.catalog?.source ?? null,
  } });
}
