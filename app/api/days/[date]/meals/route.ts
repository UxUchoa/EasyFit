import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { parseLogicalDate } from "@/lib/diary/date";
import { ensureDayLog } from "@/lib/diary/service";
import { db } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/security/request";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ date: string }> };
const customMealSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Solicitação não autorizada." }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { date } = await context.params;
  const logicalDate = parseLogicalDate(date);
  if (!logicalDate) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  const parsed = customMealSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 });

  const day = await ensureDayLog(
    session.userId,
    logicalDate,
    session.user.profile?.timezone ?? "America/Sao_Paulo",
  );
  const position = Math.max(-1, ...day.meals.map((meal) => meal.position)) + 1;
  const meal = await db.meal.create({
    data: {
      dayLogId: day.id,
      kind: "CUSTOM",
      slug: `custom-${randomUUID().slice(0, 12)}`,
      customName: parsed.data.name,
      position,
    },
  });
  return NextResponse.json({ meal }, { status: 201 });
}
