export const REMINDER_TYPES = ['MEAL', 'WORKOUT', 'CHECK_IN'] as const;
export type ReminderType = typeof REMINDER_TYPES[number];

export function isQuietMinute(minute: number, start: number | null, end: number | null) {
  if (start === null || end === null || start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export function reminderState(input: { enabled: boolean; weekdays: number[]; timeMinutes: number }, weekday: number, minute: number) {
  if (!input.enabled || !input.weekdays.includes(weekday)) return 'inactive' as const;
  if (minute < input.timeMinutes) return 'upcoming' as const;
  return 'due' as const;
}

export function timeFromMinutes(minutes: number) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
