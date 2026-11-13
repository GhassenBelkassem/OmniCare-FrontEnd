import { describe, expect, it } from 'vitest';

import {
  TUNIS_TIME_ZONE,
  addDaysToKey,
  formatTunisTime,
  formatTunisTimeRange,
  tunisDayBounds,
  tunisDayKey,
  tunisHourMinute,
  tunisInstant,
  tunisParts,
  tunisToday,
  tunisWeekRange,
  tunisWeekday,
  weekdayOfDayKey,
} from './calendar-time';

// Fixed instants written in UTC, so these tests mean the same thing whatever zone the runner uses.
// Tunis is UTC+1 all year (no daylight saving time): 2026-11-15T23:30Z is Monday 16 Nov 00:30 in Tunis.
const SUNDAY_LATE_UTC = '2026-11-15T23:30:00.000Z';

describe('calendar time (Africa/Tunis)', () => {
  it('uses the IANA zone', () => {
    expect(TUNIS_TIME_ZONE).toBe('Africa/Tunis');
  });

  describe('day key, hour and weekday', () => {
    it('puts 23:30 UTC on the next Tunis day', () => {
      expect(tunisDayKey(SUNDAY_LATE_UTC)).toBe('2026-11-16');
      expect(tunisDayKey(new Date(SUNDAY_LATE_UTC))).toBe('2026-11-16');
      expect(tunisDayKey(Date.parse(SUNDAY_LATE_UTC))).toBe('2026-11-16');
      expect(tunisWeekday(SUNDAY_LATE_UTC)).toBe(1); // Monday, not the UTC Sunday
    });

    it('keeps 22:59 UTC on the same Tunis day and 23:00 UTC on the next', () => {
      expect(tunisDayKey('2026-11-15T22:59:59.999Z')).toBe('2026-11-15');
      expect(tunisDayKey('2026-11-15T23:00:00.000Z')).toBe('2026-11-16');
    });

    it('reads hour and minute in Tunis', () => {
      expect(tunisHourMinute(SUNDAY_LATE_UTC)).toEqual({ hour: 0, minute: 30, minutes: 30 });
      expect(tunisHourMinute('2026-07-01T08:00:00.000Z')).toEqual({ hour: 9, minute: 0, minutes: 540 });
      expect(tunisHourMinute('2026-11-15T22:59:00.000Z').minutes).toBe(23 * 60 + 59);
    });

    it('crosses year and month ends', () => {
      expect(tunisDayKey('2026-12-31T23:30:00.000Z')).toBe('2027-01-01');
      expect(tunisDayKey('2028-02-28T23:30:00.000Z')).toBe('2028-02-29');
      expect(tunisDayKey('2028-02-29T23:30:00.000Z')).toBe('2028-03-01');
    });

    it('reports invalid instants without throwing', () => {
      expect(tunisDayKey('not a date')).toBe('');
      expect(tunisParts(NaN)).toBeNull();
      expect(tunisWeekday('nope')).toBeNull();
      expect(Number.isNaN(tunisHourMinute('nope').minutes)).toBe(true);
    });

    it('gives today in Tunis for a given « now »', () => {
      expect(tunisToday(new Date('2026-11-15T23:30:00.000Z'))).toBe('2026-11-16');
      expect(tunisToday('2026-11-16T22:59:59.000Z')).toBe('2026-11-16');
    });
  });

  describe('day keys', () => {
    it('finds the weekday of a date, whatever the machine zone', () => {
      expect(weekdayOfDayKey('2026-11-15')).toBe(0); // Sunday
      expect(weekdayOfDayKey('2026-11-16')).toBe(1); // Monday
      expect(weekdayOfDayKey('2026-11-21')).toBe(6);
      expect(weekdayOfDayKey('2026-02-30')).toBeNull();
      expect(weekdayOfDayKey('16/11/2026')).toBeNull();
    });

    it('adds days across month, year and leap days', () => {
      expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
      expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDaysToKey('2026-11-16', -7)).toBe('2026-11-09');
      expect(addDaysToKey('bad', 1)).toBe('');
    });
  });

  describe('Tunis wall clock to instant', () => {
    it('builds the instant of a Tunis wall clock without a hand-written offset', () => {
      expect(tunisInstant('2026-11-16', '09:00')?.toISOString()).toBe('2026-11-16T08:00:00.000Z');
      expect(tunisInstant('2026-07-16', '09:00')?.toISOString()).toBe('2026-07-16T08:00:00.000Z');
      expect(tunisInstant('2026-11-16', '00:30')?.toISOString()).toBe('2026-11-15T23:30:00.000Z');
      expect(tunisInstant('2026-11-16', '23:59:59')?.toISOString()).toBe('2026-11-16T22:59:59.000Z');
      expect(tunisInstant('2026-11-16')?.toISOString()).toBe('2026-11-15T23:00:00.000Z');
    });

    it('accepts 24:00 as the next midnight and rejects invalid input', () => {
      expect(tunisInstant('2026-11-16', '24:00')?.toISOString()).toBe('2026-11-16T23:00:00.000Z');
      expect(tunisInstant('2026-11-16', '24:30')).toBeNull();
      expect(tunisInstant('2026-11-16', '9:00')).toBeNull();
      expect(tunisInstant('2026-11-16', '10:75')).toBeNull();
      expect(tunisInstant('2026-13-01', '10:00')).toBeNull();
    });

    it('round-trips with the day key and the hour', () => {
      for (const [key, time] of [
        ['2026-01-01', '00:00'],
        ['2026-11-16', '09:15'],
        ['2026-12-31', '23:45'],
        ['2028-02-29', '12:00'],
      ] as const) {
        const instant = tunisInstant(key, time) as Date;
        expect(tunisDayKey(instant)).toBe(key);
        const { hour, minute } = tunisHourMinute(instant);
        expect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`).toBe(time);
      }
    });
  });

  describe('API ranges', () => {
    it('gives Tunis day boundaries for a date', () => {
      const day = tunisDayBounds('2026-11-16');

      expect(day?.start.toISOString()).toBe('2026-11-15T23:00:00.000Z');
      expect(day?.end.toISOString()).toBe('2026-11-16T23:00:00.000Z');
      expect(tunisDayBounds('nope')).toBeNull();
    });

    it('gives Monday 00:00 → Sunday 24:00 (Tunis) for any instant of the week', () => {
      for (const instant of [
        '2026-11-15T23:30:00.000Z', // Monday 00:30 Tunis, still Sunday in UTC
        '2026-11-16T10:00:00.000Z',
        '2026-11-21T22:59:00.000Z', // Saturday 23:59 Tunis
        '2026-11-22T22:59:59.999Z', // Sunday 23:59:59.999 Tunis
      ]) {
        const week = tunisWeekRange(instant);
        expect(week?.startKey).toBe('2026-11-16');
        expect(week?.endKey).toBe('2026-11-23');
        expect(week?.start.toISOString()).toBe('2026-11-15T23:00:00.000Z');
        expect(week?.end.toISOString()).toBe('2026-11-22T23:00:00.000Z');
      }
    });

    it('starts the next week at Monday 00:00 Tunis, i.e. 23:00 UTC on Sunday', () => {
      expect(tunisWeekRange('2026-11-22T23:00:00.000Z')?.startKey).toBe('2026-11-23');
      expect(tunisWeekRange('2026-11-22T22:59:59.999Z')?.startKey).toBe('2026-11-16');
    });

    it('works from a day key and across a month and a year', () => {
      expect(tunisWeekRange('2026-11-18')?.startKey).toBe('2026-11-16');
      expect(tunisWeekRange('2026-12-31')?.startKey).toBe('2026-12-28');
      expect(tunisWeekRange('2026-12-31')?.endKey).toBe('2027-01-04');
      expect(tunisWeekRange('2027-01-03')?.startKey).toBe('2026-12-28'); // a Sunday belongs to the week before
      expect(tunisWeekRange('nope')).toBeNull();
    });

    it('measures the week as seven Tunis days', () => {
      const week = tunisWeekRange('2026-11-18');
      expect((week?.end.getTime() ?? 0) - (week?.start.getTime() ?? 0)).toBe(7 * 24 * 3_600_000);
    });
  });

  describe('French formatting in Tunis', () => {
    it('formats times in Tunis, not in the browser zone', () => {
      expect(formatTunisTime(new Date('2026-11-16T08:00:00.000Z'))).toBe('09:00');
      expect(formatTunisTime(new Date(SUNDAY_LATE_UTC))).toBe('00:30');
      expect(formatTunisTimeRange(new Date('2026-11-16T08:00:00.000Z'), new Date('2026-11-16T08:30:00.000Z'))).toBe(
        '09:00–09:30',
      );
    });

    it('returns an empty label for a missing or invalid instant', () => {
      expect(formatTunisTime(null)).toBe('');
      expect(formatTunisTime(new Date('nope'))).toBe('');
      expect(formatTunisTimeRange(null, null)).toBe('');
    });
  });
});
