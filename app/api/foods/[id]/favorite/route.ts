import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

async function visibleFood(id: string, userId: string) {
  return db.food.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true } });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  if (!(await visibleFood(id, session.userId))) return NextResponse.json({ error: "Alimento não encontrado." }, { status: 404 });
  await db.foodFavorite.upsert({ where: { userId_foodId: { userId: session.userId, foodId: id } }, create: { userId: session.userId, foodId: id }, update: {} });
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: "food.favorite", objectType: "Food", objectId: id, result: "SUCCESS", correlationId: randomUUID() } });
  return NextResponse.json({ favorite: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { id } = await context.params;
  await db.foodFavorite.deleteMany({ where: { userId: session.userId, foodId: id } });
  await db.auditEvent.create({ data: { actorUserId: session.userId, action: "food.unfavorite", objectType: "Food", objectId: id, result: "SUCCESS", correlationId: randomUUID() } });
  return NextResponse.json({ favorite: false });
}
