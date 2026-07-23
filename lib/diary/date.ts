const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseLogicalDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function logicalDateKey(
  now: Date,
  timezone: string,
  dayClosesAtMinutes = 0,
) {
  const adjusted = new Date(now.getTime() - dayClosesAtMinutes * 60_000);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(adjusted);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(adjusted);
  }
}
