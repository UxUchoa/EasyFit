import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { parseLogicalDate } from "@/lib/diary/date";
import { diaryEntryResponse } from "@/lib/diary/response";
import { ensureDayLog } from "@/lib/diary/service";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ date: string }> };
const schema = z.object({
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceMealSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  targetMealSlug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { date } = await context.params;
  const targetDate = parseLogicalDate(date);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const sourceDate = parsed.success ? parseLogicalDate(parsed.data.sourceDate) : null;
  if (!targetDate || !sourceDate || !parsed.success) return NextResponse.json({ error: "Datas ou refeição inválidas." }, { status: 400 });
  if (date === parsed.data.sourceDate && !parsed.data.sourceMealSlug) return NextResponse.json({ error: 'Escolha um dia de origem diferente.' }, { status: 400 });

  const source = await db.dayLog.findUnique({
    where: { userId_logicalDate: { userId: session.userId, logicalDate: sourceDate } },
    include: { meals: { orderBy: { position: "asc" }, include: { entries: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!source) return NextResponse.json({ error: "O dia de origem ainda não possui registros." }, { status: 404 });
  const sourceMeals = parsed.data.sourceMealSlug ? source.meals.filter((meal) => meal.slug === parsed.data.sourceMealSlug) : source.meals;
  if (!sourceMeals.length) return NextResponse.json({ error: "Refeição de origem não encontrada." }, { status: 404 });
  const totalEntries = sourceMeals.reduce((sum, meal) => sum + meal.entries.length, 0);
  if (!totalEntries) return NextResponse.json({ error: "Não há itens para copiar." }, { status: 400 });
  if (totalEntries > 500) return NextResponse.json({ error: "Há itens demais para uma única cópia." }, { status: 413 });

  const timezone = session.user.profile?.timezone ?? "America/Sao_Paulo";
  const target = await ensureDayLog(session.userId, targetDate, timezone);
  const targetMeals = new Map(target.meals.map((meal) => [meal.slug, meal]));
  const copied = await db.$transaction(async (tx) => {
    let count = 0;
    const entries: Array<{ mealSlug: string; entry: ReturnType<typeof diaryEntryResponse> }> = [];
    for (const sourceMeal of sourceMeals) {
      const targetSlug = parsed.data.sourceMealSlug && parsed.data.targetMealSlug ? parsed.data.targetMealSlug : sourceMeal.slug;
      let targetMeal = targetMeals.get(targetSlug);
      if (!targetMeal && sourceMeal.kind === "CUSTOM") {
        targetMeal = await tx.meal.create({ data: { dayLogId: target.id, kind: "CUSTOM", slug: targetSlug, customName: sourceMeal.customName, position: sourceMeal.position } });
        targetMeals.set(targetSlug, targetMeal);
      }
      if (!targetMeal) continue;
      if (sourceMeal.entries.length) {
        const created = await tx.mealEntry.createManyAndReturn({ data: sourceMeal.entries.map((entry) => ({ mealId: targetMeal!.id, foodId: entry.foodId, copiedFromEntryId: entry.id, kind: entry.kind, quantity: entry.quantity, unit: entry.unit, snapshotName: entry.snapshotName, snapshotBrand: entry.snapshotBrand, snapshotSource: entry.snapshotSource, snapshotCalories: entry.snapshotCalories, snapshotProtein: entry.snapshotProtein, snapshotCarbohydrate: entry.snapshotCarbohydrate, snapshotFat: entry.snapshotFat, macrosComplete: entry.macrosComplete })) });
        entries.push(...created.map((entry) => ({ mealSlug: targetSlug, entry: diaryEntryResponse(entry) })));
        count += created.length;
      }
    }
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: parsed.data.sourceMealSlug ? "meal.copy" : "day.copy", objectType: "DayLog", objectId: target.id, result: "SUCCESS", correlationId: randomUUID(), context: { sourceDate: parsed.data.sourceDate, targetDate: date, copiedEntries: count } } });
    return { count, entries };
  });
  return NextResponse.json({ copiedEntries: copied.count, entries: copied.entries });
}
