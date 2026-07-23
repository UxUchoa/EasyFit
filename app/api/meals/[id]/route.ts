import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  position: z.coerce.number().int().min(0).max(100).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.meal.findFirst({
    where: { id, kind: "CUSTOM", dayLog: { userId: session.userId } },
  });
  if (!owned) return NextResponse.json({ error: "Refeição não encontrada." }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  if (parsed.data.position !== undefined && parsed.data.position !== owned.position) {
    const target = await db.meal.findFirst({
      where: { dayLogId: owned.dayLogId, position: parsed.data.position, id: { not: id } },
    });
    await db.$transaction(async (tx) => {
      if (target) {
        await tx.meal.update({ where: { id: target.id }, data: { position: owned.position } });
      }
      await tx.meal.update({
        where: { id },
        data: { customName: parsed.data.name, position: parsed.data.position },
      });
    });
  } else {
    await db.meal.update({ where: { id }, data: { customName: parsed.data.name } });
  }
  const meal = await db.meal.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ meal });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  const owned = await db.meal.findFirst({
    where: { id, kind: "CUSTOM", dayLog: { userId: session.userId } },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Refeição não encontrada." }, { status: 404 });
  await db.meal.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
