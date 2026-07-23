import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";

const nullableNutrient = z.union([z.coerce.number().min(0).max(100_000), z.null()]).optional();
const privateFoodSchema = z.object({
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(120).optional(),
  barcode: z.string().trim().regex(/^\d{8,14}$/).optional().or(z.literal("")),
  baseQuantity: z.coerce.number().positive().max(100_000),
  baseUnit: z.enum(["g", "kg", "ml", "l", "unidade"]),
  calories: z.coerce.number().min(0).max(100_000),
  proteinGrams: nullableNutrient,
  carbohydrateGrams: nullableNutrient,
  fatGrams: nullableNutrient,
  fiberGrams: nullableNutrient,
  portion: z
    .object({
      name: z.string().trim().min(1).max(80),
      unit: z.string().trim().min(1).max(24),
      quantityInBaseUnit: z.coerce.number().positive().max(100_000),
    })
    .optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const foods = await db.food.findMany({
    where: { ownerId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: { portions: true },
    take: 100,
  });
  return NextResponse.json({ foods });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const parsed = privateFoodSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados do alimento." },
      { status: 400 },
    );
  }

  const { portion, brand, barcode, ...data } = parsed.data;
  const food = await db.food.create({
    data: {
      ...data,
      brand: brand || null,
      barcode: barcode || null,
      proteinGrams: data.proteinGrams ?? null,
      carbohydrateGrams: data.carbohydrateGrams ?? null,
      fatGrams: data.fatGrams ?? null,
      fiberGrams: data.fiberGrams ?? null,
      ownerId: session.userId,
      source: "PRIVATE",
      portions: portion ? { create: portion } : undefined,
    },
    include: { portions: true },
  });

  await db.auditEvent.create({
    data: {
      actorUserId: session.userId,
      action: "private_food.create",
      objectType: "Food",
      objectId: food.id,
      result: "SUCCESS",
      correlationId: crypto.randomUUID(),
    },
  });
  return NextResponse.json({ food }, { status: 201 });
}
