import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountCenter } from "@/components/account-center";
import { approximateLocation, describeUserAgent } from "@/lib/auth/device";
import { getCurrentSession, isRecentlyReauthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPTIONAL_ANALYTICS_CONSENT } from "@/lib/privacy/policy";

export const metadata: Metadata = { title: "Conta e privacidade" };

export default async function AccountPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/entrar");

  const [sessions, exports, analyticsConsent] = await Promise.all([
    db.session.findMany({ where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastActiveAt: "desc" } }),
    db.subjectRequest.findMany({ where: { userId: current.userId, kind: "EXPORT" }, orderBy: { requestedAt: "desc" }, take: 20, select: { id: true, receiptCode: true, status: true, requestedAt: true, completedAt: true, expiresAt: true } }),
    db.consentRecord.findFirst({ where: { userId: current.userId, purpose: OPTIONAL_ANALYTICS_CONSENT, revokedAt: null }, select: { id: true } }),
  ]);

  return <AccountCenter username={current.user.username} userScope={current.userId} initiallyReauthenticated={isRecentlyReauthenticated(current)} analyticsAccepted={Boolean(analyticsConsent)} initialSessions={sessions.map((session) => ({ id: session.id, current: session.id === current.id, device: describeUserAgent(session.userAgent), location: approximateLocation(session), createdAt: session.createdAt.toISOString(), lastActiveAt: session.lastActiveAt.toISOString(), expiresAt: session.expiresAt.toISOString() }))} initialExports={exports.map((item) => ({ ...item, requestedAt: item.requestedAt.toISOString(), completedAt: item.completedAt?.toISOString() ?? null, expiresAt: item.expiresAt?.toISOString() ?? null }))} />;
}
