import { describe, expect, it } from 'vitest';
import { isQuietMinute, reminderState, timeFromMinutes } from './schedule';

describe('notification schedule', () => {
  it('handles quiet windows that cross midnight', () => {
    expect(isQuietMinute(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isQuietMinute(12 * 60, 22 * 60, 7 * 60)).toBe(false);
  });

  it('keeps in-app reminder state independent from quiet hours', () => {
    const preference = { enabled: true, weekdays: [1, 3, 5], timeMinutes: 9 * 60 };
    expect(reminderState(preference, 3, 8 * 60)).toBe('upcoming');
    expect(reminderState(preference, 3, 10 * 60)).toBe('due');
    expect(reminderState(preference, 4, 10 * 60)).toBe('inactive');
  });

  it('formats minute offsets as time fields', () => {
    expect(timeFromMinutes(75)).toBe('01:15');
  });
});
