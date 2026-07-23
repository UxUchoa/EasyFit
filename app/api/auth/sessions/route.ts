import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { approximateLocation, describeUserAgent } from "@/lib/auth/device";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentSession();
  if (!current) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const sessions = await db.session.findMany({
    where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      current: session.id === current.id,
      device: describeUserAgent(session.userAgent),
      location: approximateLocation(session),
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
    })),
  });
}
