export const REAUTHENTICATION_WINDOW_MS = 5 * 60 * 1000;

export function isRecentlyReauthenticated(
  session: { reauthenticatedAt: Date | null },
  now = new Date(),
) {
  const elapsed = session.reauthenticatedAt
    ? now.getTime() - session.reauthenticatedAt.getTime()
    : null;
  return Boolean(
    elapsed !== null &&
      elapsed >= 0 &&
      elapsed <= REAUTHENTICATION_WINDOW_MS,
  );
}
