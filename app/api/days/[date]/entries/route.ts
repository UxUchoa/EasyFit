import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { parseLogicalDate } from "@/lib/diary/date";
import { calculateEntryNutrition } from "@/lib/diary/nutrition";
import { ensureDayLog } from "@/lib/diary/service";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";
import { foodConflictGroups, foodConflictKey } from '@/lib/catalog/conflicts';

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ date: string }> };

const entrySchema = z
  .object({
    mealSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
    kind: z.enum(["PLANNED", "CONSUMED"]).default("CONSUMED"),
    foodId: z.string().cuid().optional(),
    sourceConflictKey: z.string().trim().min(1).max(320).optional(),
    quantity: z.coerce.number().positive().max(100_000),
    unit: z.string().trim().min(1).max(24),
    quick: z
      .object({
        name: z.string().trim().min(2).max(180),
        calories: z.coerce.number().min(0).max(100_000),
        proteinGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
        carbohydrateGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
        fatGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
      })
      .optional(),
  })
  .refine((value) => Boolean(value.foodId) !== Boolean(value.quick), {
    message: "Escolha um alimento ou use a adição rápida.",
  })
  .refine((value) => !value.sourceConflictKey || Boolean(value.foodId), {
    message: 'A resolução de fonte exige um alimento do catálogo.',
  });

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { date } = await context.params;
  const logicalDate = parseLogicalDate(date);
  if (!logicalDate) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const parsed = entrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 80);
  if (idempotencyKey) {
    const existing = await db.mealEntry.findUnique({
      where: { clientMutationId: idempotencyKey },
      include: { meal: { include: { dayLog: { select: { userId: true } } } } },
    });
    if (existing) {
      if (existing.meal.dayLog.userId !== session.userId) {
        return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 409 });
      }
      return NextResponse.json({ entry: existing, replayed: true });
    }
  }

  const timezone = session.user.profile?.timezone ?? "America/Sao_Paulo";
  const day = await ensureDayLog(session.userId, logicalDate, timezone);
  const meal = day.meals.find((candidate) => candidate.slug === parsed.data.mealSlug);
  if (!meal) {
    return NextResponse.json({ error: "Refeição inválida." }, { status: 400 });
  }

  let snapshot:
    | {
        foodId: string | null;
        name: string;
        brand: string | null;
        source: string;
        calories: number;
        proteinGrams: number | null;
        carbohydrateGrams: number | null;
        fatGrams: number | null;
      }
    | undefined;
  let conflictResolution: { conflictKey: string; selectedFoodId: string; selectedName: string; selectedSource: string; alternatives: Array<Record<string, string | number | null>> } | null = null;

  if (parsed.data.foodId) {
    const food = await db.food.findFirst({
      where: {
        id: parsed.data.foodId,
        OR: [{ ownerId: null }, { ownerId: session.userId }],
      },
      include: { portions: true },
    });
    if (!food) return NextResponse.json({ error: "Alimento não encontrado." }, { status: 404 });
    const nutrients = calculateEntryNutrition(
      {
        baseQuantity: Number(food.baseQuantity),
        baseUnit: food.baseUnit,
        calories: Number(food.calories),
        proteinGrams: food.proteinGrams === null ? null : Number(food.proteinGrams),
        carbohydrateGrams:
          food.carbohydrateGrams === null ? null : Number(food.carbohydrateGrams),
        fatGrams: food.fatGrams === null ? null : Number(food.fatGrams),
        portions: food.portions.map((portion) => ({
          name: portion.name,
          unit: portion.unit,
          quantityInBaseUnit: Number(portion.quantityInBaseUnit),
        })),
      },
      parsed.data.quantity,
      parsed.data.unit,
    );
    if (!nutrients) {
      return NextResponse.json(
        { error: `Não é possível converter ${parsed.data.unit} para ${food.baseUnit}.` },
        { status: 400 },
      );
    }
    snapshot = {
      foodId: food.id,
      name: food.name,
      brand: food.brand,
      source: food.source,
      ...nutrients,
    };
    if (parsed.data.sourceConflictKey) {
      const expectedKey = foodConflictKey(food);
      if (parsed.data.sourceConflictKey !== expectedKey) return NextResponse.json({ error: 'O grupo de fontes informado é inválido.' }, { status: 400 });
      const candidates = await db.food.findMany({
        where: {
          AND: [
            { OR: [{ ownerId: null }, { ownerId: session.userId }] },
            food.barcode
              ? { barcode: food.barcode }
              : { name: { equals: food.name, mode: 'insensitive' }, brand: food.brand === null ? null : { equals: food.brand, mode: 'insensitive' }, baseUnit: food.baseUnit },
          ],
        },
      });
      const alternatives = foodConflictGroups(candidates).get(expectedKey) ?? [];
      if (alternatives.length < 2 || !alternatives.some((candidate) => candidate.id === food.id)) return NextResponse.json({ error: 'Este alimento não possui conflito de fontes ativo.' }, { status: 400 });
      conflictResolution = {
        conflictKey: expectedKey,
        selectedFoodId: food.id,
        selectedName: food.name,
        selectedSource: food.source,
        alternatives: alternatives.map((candidate) => ({ id: candidate.id, name: candidate.name, brand: candidate.brand, source: candidate.source, baseQuantity: Number(candidate.baseQuantity), baseUnit: candidate.baseUnit, calories: Number(candidate.calories), proteinGrams: candidate.proteinGrams === null ? null : Number(candidate.proteinGrams), carbohydrateGrams: candidate.carbohydrateGrams === null ? null : Number(candidate.carbohydrateGrams), fatGrams: candidate.fatGrams === null ? null : Number(candidate.fatGrams) })),
      };
    }
  } else if (parsed.data.quick) {
    snapshot = {
      foodId: null,
      name: parsed.data.quick.name,
      brand: null,
      source: "QUICK_ADD",
      calories: parsed.data.quick.calories,
      proteinGrams: parsed.data.quick.proteinGrams ?? null,
      carbohydrateGrams: parsed.data.quick.carbohydrateGrams ?? null,
      fatGrams: parsed.data.quick.fatGrams ?? null,
    };
  }

  if (!snapshot) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  const macrosComplete =
    snapshot.proteinGrams !== null &&
    snapshot.carbohydrateGrams !== null &&
    snapshot.fatGrams !== null;
  const correlationId = randomUUID();

  const entry = await db.$transaction(async (tx) => {
    const created = await tx.mealEntry.create({
      data: {
        clientMutationId: idempotencyKey || null,
        mealId: meal.id,
        foodId: snapshot.foodId,
        kind: parsed.data.kind,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        snapshotName: snapshot.name,
        snapshotBrand: snapshot.brand,
        snapshotSource: snapshot.source,
        snapshotCalories: snapshot.calories,
        snapshotProtein: snapshot.proteinGrams,
        snapshotCarbohydrate: snapshot.carbohydrateGrams,
        snapshotFat: snapshot.fatGrams,
        macrosComplete,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "meal_entry.create",
        objectType: "MealEntry",
        objectId: created.id,
        result: "SUCCESS",
        correlationId,
        context: { logicalDate: date, mealSlug: parsed.data.mealSlug },
      },
    });
    if (conflictResolution) {
      await tx.foodSourceChoice.upsert({
        where: { userId_conflictKey: { userId: session.userId, conflictKey: conflictResolution.conflictKey } },
        create: { userId: session.userId, conflictKey: conflictResolution.conflictKey, selectedFoodId: conflictResolution.selectedFoodId, selectedSnapshotName: conflictResolution.selectedName, selectedSnapshotSource: conflictResolution.selectedSource, alternativesSnapshot: conflictResolution.alternatives, chosenAt: new Date() },
        update: { selectedFoodId: conflictResolution.selectedFoodId, selectedSnapshotName: conflictResolution.selectedName, selectedSnapshotSource: conflictResolution.selectedSource, alternativesSnapshot: conflictResolution.alternatives, chosenAt: new Date() },
      });
      await tx.auditEvent.create({ data: { actorUserId: session.userId, action: 'food_source.choice', objectType: 'Food', objectId: conflictResolution.selectedFoodId, result: 'SUCCESS', correlationId, context: { selectedSource: conflictResolution.selectedSource, alternativeCount: conflictResolution.alternatives.length } } });
    }
    return created;
  });

  return NextResponse.json({ entry }, { status: 201 });
}
