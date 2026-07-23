const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIMEZONE = "America/Sao_Paulo";

type ZonedDateTimeParts = {
  dateKey: string;
  weekday: number;
  hour: number;
  minute: number;
};

export function parseLogicalDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  if (Number(value.slice(0, 4)) < 1) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function shiftLogicalDate(value: string, days: number) {
  const date = parseLogicalDate(value);
  if (!date || !Number.isInteger(days)) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isSupportedTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTimeParts(now: Date, timezone: string): ZonedDateTimeParts {
  const safeTimezone = isSupportedTimeZone(timezone) ? timezone : FALLBACK_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const calendarDate = parseLogicalDate(dateKey);
  if (!calendarDate || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new RangeError("Unable to derive a valid zoned date and time.");
  }
  return { dateKey, weekday: calendarDate.getUTCDay(), hour, minute };
}

export function calendarDateKey(now: Date, timezone: string) {
  return zonedDateTimeParts(now, timezone).dateKey;
}

export function logicalDateKey(
  now: Date,
  timezone: string,
  dayClosesAtMinutes = 0,
) {
  const parts = zonedDateTimeParts(now, timezone);
  const close = Number.isInteger(dayClosesAtMinutes) && dayClosesAtMinutes >= 0 && dayClosesAtMinutes <= 1439
    ? dayClosesAtMinutes
    : 0;
  if (parts.hour * 60 + parts.minute >= close) return parts.dateKey;
  return shiftLogicalDate(parts.dateKey, -1)!;
}
