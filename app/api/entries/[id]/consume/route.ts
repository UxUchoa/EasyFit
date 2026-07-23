import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const planned = await db.mealEntry.findFirst({
    where: { id, kind: "PLANNED", meal: { dayLog: { userId: session.userId } } },
  });
  if (!planned) return NextResponse.json({ error: "Registro planejado não encontrado." }, { status: 404 });

  const existing = await db.mealEntry.findFirst({
    where: { originEntryId: planned.id, kind: "CONSUMED" },
  });
  if (existing) return NextResponse.json({ entry: existing, replayed: true });

  try {
    const consumed = await db.$transaction(async (tx) => {
      const created = await tx.mealEntry.create({
        data: {
          mealId: planned.mealId,
          foodId: planned.foodId,
          kind: "CONSUMED",
          quantity: planned.quantity,
          unit: planned.unit,
          snapshotName: planned.snapshotName,
          snapshotBrand: planned.snapshotBrand,
          snapshotSource: planned.snapshotSource,
          snapshotCalories: planned.snapshotCalories,
          snapshotProtein: planned.snapshotProtein,
          snapshotCarbohydrate: planned.snapshotCarbohydrate,
          snapshotFat: planned.snapshotFat,
          macrosComplete: planned.macrosComplete,
          originEntryId: planned.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: session.userId,
          action: "meal_entry.confirm_consumed",
          objectType: "MealEntry",
          objectId: created.id,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: { originEntryId: planned.id },
        },
      });
      return created;
    });
    return NextResponse.json({ entry: consumed }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replayed = await db.mealEntry.findFirst({
        where: { originEntryId: planned.id, kind: "CONSUMED" },
      });
      return NextResponse.json({ entry: replayed, replayed: true });
    }
    throw error;
  }
}
