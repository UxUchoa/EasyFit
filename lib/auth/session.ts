import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionRotationIsDue, sessionTtlMs } from '@/lib/auth/session-policy';
export { isRecentlyReauthenticated, REAUTHENTICATION_WINDOW_MS } from "@/lib/auth/reauthentication";

const SESSION_COOKIE = "easyfit_session";

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const headerStore = await headers();
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  const decodeHeader = (value: string | null) => {
    if (!value) return null;
    try { return decodeURIComponent(value).slice(0, 120); } catch { return value.slice(0, 120); }
  };
  const session = await db.session.create({
    data: {
      userId,
      tokenHash: digestToken(token),
      userAgent: headerStore.get("user-agent")?.slice(0, 500),
      ipPrefix: null,
      countryCode: headerStore.get("x-vercel-ip-country")?.slice(0, 8),
      region: decodeHeader(headerStore.get("x-vercel-ip-country-region")),
      city: decodeHeader(headerStore.get("x-vercel-ip-city")),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session.id;
}

export const getCurrentSession = cache(async function getCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findFirst({
    where: {
      tokenHash: digestToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          onboardingDone: true,
          role: true,
          profile: {
            select: {
              displayName: true,
              birthDate: true,
              biologicalSex: true,
              heightCm: true,
              currentWeightKg: true,
              desiredWeightKg: true,
              activityLevel: true,
              timezone: true,
              dayClosesAtMinutes: true,
              objective: true,
              trainingExperience: true,
              trainingDaysPerWeek: true,
              physicalRestrictions: true,
              availableEquipment: true,
              priorityMuscleGroups: true,
            },
          },
        },
      },
    },
  });
  if (session && Date.now() - session.lastActiveAt.getTime() >= 5 * 60 * 1000) {
    const lastActiveAt = new Date();
    await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastActiveAt } });
    session.lastActiveAt = lastActiveAt;
  }
  return session;
});

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) redirect("/entrar");
  return session.user;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.updateMany({
      where: { tokenHash: digestToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function markCurrentSessionReauthenticated(sessionId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { reauthenticatedAt: new Date(), lastActiveAt: new Date() },
  });
}

export async function rotateCurrentSessionIfDue(session: { id: string; tokenHash: string; rotatedAt: Date; expiresAt: Date }) {
  if (!sessionRotationIsDue(session.rotatedAt)) return false;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = digestToken(token);
  const rotated = await db.session.updateMany({ where: { id: session.id, tokenHash: session.tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, data: { tokenHash, rotatedAt: new Date(), lastActiveAt: new Date() } });
  if (rotated.count !== 1) return false;
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: session.expiresAt });
  return true;
}
