import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseLogicalDate } from "@/lib/diary/date";
import { diaryEntryResponse } from "@/lib/diary/response";
import { ensureDayLog } from "@/lib/diary/service";
import { dietPlanSnapshotSchema, groupDietItemsByMeal, itemsForDietDate } from "@/lib/imports/snapshot";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealLabel: z.string().trim().min(1).max(80),
}).strict();

function mutationId(versionId: string, date: string, sourcePointer: string) {
  const hash = createHash("sha256").update(`${versionId}:${date}:${sourcePointer}`).digest("hex").slice(0, 24);
  return `diet:${versionId.slice(0, 24)}:${date}:${hash}`.slice(0, 80);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise a refeição." }, { status: 400 });
  const logicalDate = parseLogicalDate(parsed.data.date);
  if (!logicalDate) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const plan = await db.dietPlan.findFirst({
    where: { userId: session.userId, active: true },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const version = plan?.versions[0];
  if (!plan || !version) return NextResponse.json({ error: "Nenhuma dieta ativa encontrada." }, { status: 404 });
  const snapshot = dietPlanSnapshotSchema.safeParse(version.snapshot);
  if (!snapshot.success) return NextResponse.json({ error: "A versão ativa da dieta não possui dados compatíveis." }, { status: 409 });
  const meal = groupDietItemsByMeal(itemsForDietDate(snapshot.data, parsed.data.date))
    .find((candidate) => candidate.label === parsed.data.mealLabel);
  if (!meal?.slug) return NextResponse.json({ error: "A refeição não corresponde a um horário do diário." }, { status: 400 });
  const applicable = meal.items.filter((item) => item.nutrition !== null);
  const skipped = meal.items.length - applicable.length;
  if (!applicable.length) return NextResponse.json({ error: "Esta refeição ainda não possui valores nutricionais calculados." }, { status: 409 });

  const timezone = session.user.profile?.timezone ?? "America/Sao_Paulo";
  const day = await ensureDayLog(session.userId, logicalDate, timezone);
  const diaryMeal = day.meals.find((candidate) => candidate.slug === meal.slug);
  if (!diaryMeal) return NextResponse.json({ error: "Refeição inválida para este diário." }, { status: 400 });
  const foodIds = applicable.flatMap((item) => item.catalog?.foodId ? [item.catalog.foodId] : []);
  const availableFoods = foodIds.length ? await db.food.findMany({ where: { id: { in: foodIds }, OR: [{ ownerId: null }, { ownerId: session.userId }] }, select: { id: true } }) : [];
  const availableFoodIds = new Set(availableFoods.map((food) => food.id));
  const correlationId = randomUUID();

  const entries = await db.$transaction(async (tx) => {
    const saved = [];
    for (const item of applicable) {
      const nutrition = item.nutrition!;
      const clientMutationId = mutationId(version.id, parsed.data.date, item.sourcePointer);
      saved.push(await tx.mealEntry.upsert({
        where: { clientMutationId },
        create: {
          clientMutationId,
          mealId: diaryMeal.id,
          foodId: item.catalog?.foodId && availableFoodIds.has(item.catalog.foodId) ? item.catalog.foodId : null,
          kind: "CONSUMED",
          quantity: item.quantity,
          unit: item.unit.slice(0, 16),
          snapshotName: item.name,
          snapshotBrand: null,
          snapshotSource: item.catalog?.source ?? "DIET_IMPORT",
          snapshotCalories: nutrition.calories,
          snapshotProtein: nutrition.proteinGrams,
          snapshotCarbohydrate: nutrition.carbohydrateGrams,
          snapshotFat: nutrition.fatGrams,
          macrosComplete: nutrition.proteinGrams !== null && nutrition.carbohydrateGrams !== null && nutrition.fatGrams !== null,
        },
        update: {},
      }));
    }
    await tx.auditEvent.create({ data: {
      actorUserId: session.userId,
      action: "diet_plan.meal.consume",
      objectType: "DietPlanVersion",
      objectId: version.id,
      result: "SUCCESS",
      correlationId,
      context: { date: parsed.data.date, meal: meal.label, itemCount: saved.length, skippedCount: skipped },
    } });
    return saved;
  });

  return NextResponse.json({ entries: entries.map((entry) => diaryEntryResponse(entry)), mealSlug: meal.slug, skipped });
}
