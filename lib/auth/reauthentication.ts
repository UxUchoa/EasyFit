export const REAUTHENTICATION_WINDOW_MS = 5 * 60 * 1000;

export function isRecentlyReauthenticated(
  session: { reauthenticatedAt: Date | null },
  now = new Date(),
) {
  return Boolean(
    session.reauthenticatedAt &&
      now.getTime() - session.reauthenticatedAt.getTime() <= REAUTHENTICATION_WINDOW_MS,
  );
}
