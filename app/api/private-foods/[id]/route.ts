import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  barcode: z.string().trim().regex(/^\d{8,14}$/).nullable().optional(),
  baseQuantity: z.coerce.number().positive().max(100_000).optional(),
  baseUnit: z.enum(["g", "kg", "ml", "l", "unidade"]).optional(),
  calories: z.coerce.number().min(0).max(100_000).optional(),
  proteinGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
  carbohydrateGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
  fatGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
  fiberGrams: z.coerce.number().min(0).max(100_000).nullable().optional(),
  portions: z.array(z.object({ name: z.string().trim().min(1).max(80), unit: z.string().trim().min(1).max(24), quantityInBaseUnit: z.coerce.number().positive().max(100_000) })).max(20).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.food.findFirst({ where: { id, ownerId: session.userId } });
  if (!owned) return NextResponse.json({ error: "Alimento não encontrado." }, { status: 404 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { portions, ...data } = parsed.data;
  const food = await db.$transaction(async (tx) => {
    await tx.food.update({ where: { id }, data });
    if (portions) {
      await tx.foodPortion.deleteMany({ where: { foodId: id } });
      if (portions.length) await tx.foodPortion.createMany({ data: portions.map((portion) => ({ foodId: id, ...portion })) });
    }
    await tx.auditEvent.create({ data: { actorUserId: session.userId, action: "private_food.update", objectType: "Food", objectId: id, result: "SUCCESS", correlationId: crypto.randomUUID() } });
    return tx.food.findUniqueOrThrow({ where: { id }, include: { portions: true } });
  });
  return NextResponse.json({ food });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.food.findFirst({ where: { id, ownerId: session.userId } });
  if (!owned) return NextResponse.json({ error: "Alimento não encontrado." }, { status: 404 });

  await db.$transaction([
    db.food.delete({ where: { id } }),
    db.auditEvent.create({
      data: {
        actorUserId: session.userId,
        action: "private_food.delete",
        objectType: "Food",
        objectId: id,
        result: "SUCCESS",
        correlationId: crypto.randomUUID(),
      },
    }),
  ]);
  return new NextResponse(null, { status: 204 });
}
