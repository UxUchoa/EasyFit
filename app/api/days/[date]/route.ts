import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { parseLogicalDate } from "@/lib/diary/date";
import { findDayLog } from "@/lib/diary/service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ date: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { date } = await context.params;
  const logicalDate = parseLogicalDate(date);
  if (!logicalDate) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const day = await findDayLog(session.userId, logicalDate);
  return NextResponse.json({ day });
}
