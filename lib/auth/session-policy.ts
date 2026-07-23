function configuredNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function sessionTtlMs() {
  return configuredNumber(process.env.SESSION_TTL_DAYS, 30, 1, 90) * 86_400_000;
}

export function sessionRotationMs() {
  return configuredNumber(process.env.SESSION_ROTATION_HOURS, 24, 1, 168) * 3_600_000;
}

export function sessionRotationIsDue(rotatedAt: Date, now = new Date()) {
  return now.getTime() - rotatedAt.getTime() >= sessionRotationMs();
}

