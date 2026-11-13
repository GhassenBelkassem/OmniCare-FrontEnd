import { describe, expect, it } from 'vitest';

import type { AvailabilityExceptionDto, AvailabilityRuleDto } from '../appointment-api.models';
import {
  addEstimatedMinutesToInstant,
  calendarPeriodTitle,
  consultationSlotMinutes,
  exceptionWallClockDateTime,
  isWorkingTime,
  minutesToDuration,
  paddedSlotBounds,
  fullyBlockedDateKeys,
  preserveAppointmentInstant,
  preserveWallClockTime,
  projectBusinessHours,
  projectGridBusinessHours,
  toCalendarVisibleRange,
  toFullCalendarWeekday,
  weekdaysToHide,
  formatCalendarTime,
  formatCalendarTimeRange,
} from './calendar-time.adapter';
import { at } from './calendar-time.testing';

function rule(overrides: Partial<AvailabilityRuleDto> = {}): AvailabilityRuleDto {
  return {
    dayOfWeek: 'MONDAY',
    active: true,
    startTime: '09:00',
    endTime: '17:00',
    pauseStart: null,
    pauseEnd: null,
    slotDurationMinutes: 30,
    ...overrides,
  };
}

describe('calendar time adapter', () => {
  it('preserves appointment instant strings exactly', () => {
    const instant = '2026-10-08T09:17:23.456+01:00';
    expect(preserveAppointmentInstant(instant)).toBe(instant);
  });

  it('adds an explicit estimated duration to an urgent instant', () => {
    expect(addEstimatedMinutesToInstant('2031-04-08T14:00:00.000Z', 30)).toBe(
      '2031-04-08T14:30:00.000Z',
    );
    expect(addEstimatedMinutesToInstant('invalid', 30)).toBeNull();
  });

  it('keeps the appointment range end exclusive', () => {
    const range = toCalendarVisibleRange(
      new Date('2031-04-01T00:00:00.000Z'),
      new Date('2031-05-01T00:00:00.000Z'),
    );
    expect(range.appointmentTo).toBe('2031-05-01T00:00:00.000Z');
  });

  it('converts the exclusive end to an inclusive exception date', () => {
    const range = toCalendarVisibleRange(at('2031-04-01'), at('2031-05-01'));
    expect(range.exceptionFrom).toBe('2031-04-01');
    expect(range.exceptionToInclusive).toBe('2031-04-30');
  });

  it('maps backend weekdays to FullCalendar Sunday-zero weekdays', () => {
    expect(toFullCalendarWeekday('SUNDAY')).toBe(0);
    expect(toFullCalendarWeekday('MONDAY')).toBe(1);
    expect(toFullCalendarWeekday('SATURDAY')).toBe(6);
  });

  it('preserves HH:mm as wall clock with no conversion', () => {
    expect(preserveWallClockTime('09:15')).toBe('09:15');
    expect(exceptionWallClockDateTime('2031-04-08', '09:15')).toBe('2031-04-08T09:15:00');
  });

  it('does not append an accidental timezone to exception wall clock values', () => {
    expect(exceptionWallClockDateTime('2031-04-08', '14:00')).not.toMatch(/[zZ]|[+-]\d\d:/);
  });
});

describe('full-day BLOCK classification', () => {
  const fridayRule = rule({
    dayOfWeek: 'FRIDAY',
    startTime: '09:00',
    endTime: '15:00',
  });
  const block = (startTime: string, endTime: string): AvailabilityExceptionDto => ({
    id: `${startTime}-${endTime}`,
    exceptionDate: '2026-10-09',
    type: 'BLOCK',
    startTime,
    endTime,
    reason: null,
  });

  it('classifies a BLOCK covering the effective working interval', () => {
    expect(fullyBlockedDateKeys([fridayRule], [block('09:00', '15:00')])).toContain('2026-10-09');
  });

  it('does not classify a partial BLOCK as a fully unavailable date', () => {
    expect(fullyBlockedDateKeys([fridayRule], [block('12:00', '13:00')])).not.toContain(
      '2026-10-09',
    );
  });

  it('does not invent a full-day BLOCK for a closed weekday', () => {
    expect(fullyBlockedDateKeys([], [block('00:00', '23:59')])).toEqual(new Set());
  });

  it('allows adjacent BLOCK rows to cover working segments around a pause', () => {
    const paused = rule({
      dayOfWeek: 'FRIDAY',
      startTime: '09:00',
      endTime: '15:00',
      pauseStart: '12:00',
      pauseEnd: '13:00',
    });
    expect(
      fullyBlockedDateKeys([paused], [block('09:00', '12:00'), block('13:00', '15:00')]),
    ).toContain('2026-10-09');
  });
});

describe('business hours projection', () => {
  it('maps an active rule without pause to one segment', () => {
    expect(projectBusinessHours([rule()])).toEqual([
      { daysOfWeek: [1], startTime: '09:00', endTime: '17:00' },
    ]);
  });

  it('splits a valid pause into two segments', () => {
    expect(projectBusinessHours([rule({ pauseStart: '13:00', pauseEnd: '14:00' })])).toEqual([
      { daysOfWeek: [1], startTime: '09:00', endTime: '13:00' },
      { daysOfWeek: [1], startTime: '14:00', endTime: '17:00' },
    ]);
  });

  it('omits inactive rules', () => {
    expect(projectBusinessHours([rule({ active: false })])).toEqual([]);
  });

  it('does not invent segments for absent weekdays', () => {
    expect(projectBusinessHours([])).toEqual([]);
  });

  it('maps multiple weekdays independently', () => {
    expect(
      projectBusinessHours([rule(), rule({ dayOfWeek: 'FRIDAY', startTime: '10:00' })]),
    ).toEqual([
      { daysOfWeek: [1], startTime: '09:00', endTime: '17:00' },
      { daysOfWeek: [5], startTime: '10:00', endTime: '17:00' },
    ]);
  });
});

describe('calendar time helpers (Phase 3)', () => {
  const rule = (day: 'MONDAY' | 'TUESDAY', start: string, end: string) => ({
    dayOfWeek: day,
    active: true,
    startTime: start,
    endTime: end,
    pauseStart: '12:00',
    pauseEnd: '13:00',
    slotDurationMinutes: 20,
  });

  it('titles a week in French with spaced range', () => {
    expect(calendarPeriodTitle('week', at('2026-11-09'), at('2026-11-16'))).toBe(
      '9 – 15 nov. 2026',
    );
    expect(calendarPeriodTitle('week', at('2026-11-30'), at('2026-12-07'))).toBe(
      '30 nov. – 6 déc. 2026',
    );
  });

  it('pads the visible grid by one hour and uses the rule slot length', () => {
    const rules = [rule('MONDAY', '08:30', '17:00'), rule('TUESDAY', '09:00', '18:00')];
    expect(paddedSlotBounds(rules)).toEqual({ min: '07:00:00', max: '19:00:00' });
    expect(consultationSlotMinutes(rules)).toBe(20);
    expect(minutesToDuration(20)).toBe('00:20:00');
  });

  it('treats pauses, BLOCK exceptions and closed days as non-working', () => {
    const rules = [rule('MONDAY', '08:00', '17:00')];
    const monday = (hours: number) => at('2026-11-09', `${String(hours).padStart(2, '0')}:00`);
    expect(isWorkingTime(monday(9), rules, [])).toBe(true);
    expect(isWorkingTime(monday(12), rules, [])).toBe(false);
    expect(isWorkingTime(monday(18), rules, [])).toBe(false);
    expect(isWorkingTime(at('2026-11-10', '09:00'), rules, [])).toBe(false);
    const block = {
      id: 'b', exceptionDate: '2026-11-09', type: 'BLOCK' as const,
      startTime: '08:00', endTime: '10:00', reason: null,
    };
    expect(isWorkingTime(monday(9), rules, [block])).toBe(false);
    const extra = { ...block, id: 'e', type: 'EXTRA' as const, startTime: '18:00', endTime: '19:00' };
    expect(isWorkingTime(monday(18), rules, [extra])).toBe(true);
  });
});

describe('weekdaysToHide', () => {
  const week = {
    startMs: at('2031-04-07').getTime(), // Monday
    endMs: at('2031-04-14').getTime(),
  };
  const open = (...days: AvailabilityRuleDto['dayOfWeek'][]): AvailabilityRuleDto[] =>
    days.map((dayOfWeek) => rule({ dayOfWeek }));
  const atDay = (day: number): number => at(`2031-04-${String(day).padStart(2, '0')}`, '10:00').getTime();
  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

  it('hides the weekdays that have no active rule and no appointment', () => {
    expect(weekdaysToHide(open(...weekdays), [], week)).toEqual([0, 6]); // Sunday and Saturday
  });

  it('shows a closed weekday that has a loaded appointment in the visible week', () => {
    expect(weekdaysToHide(open(...weekdays), [atDay(13)], week)).toEqual([6]); // Sunday 13 shown
  });

  it('ignores appointments outside the visible range (stale data from another week)', () => {
    expect(weekdaysToHide(open('MONDAY'), [atDay(20), atDay(6), Number.NaN], week)).toEqual([
      0, 2, 3, 4, 5, 6,
    ]);
  });

  it('does not count an inactive rule as an open day', () => {
    const rules = [rule({ dayOfWeek: 'MONDAY' }), rule({ dayOfWeek: 'TUESDAY', active: false })];

    expect(weekdaysToHide(rules, [], week)).toEqual([0, 2, 3, 4, 5, 6]);
  });

  it('hides nothing when no day would be shown (FullCalendar rejects seven hidden days)', () => {
    expect(weekdaysToHide([], [], week)).toEqual([]);
    expect(weekdaysToHide(open(), [], null)).toEqual([]);
  });

  it('still honours the rules when the range is unknown', () => {
    expect(weekdaysToHide(open('MONDAY', 'FRIDAY'), [atDay(9)], null)).toEqual([0, 2, 3, 4, 6]);
  });
});

describe('calendar time adapter in Africa/Tunis', () => {
  const ruleOf = (day: AvailabilityRuleDto['dayOfWeek'], startTime: string, endTime: string) =>
    rule({ dayOfWeek: day, startTime, endTime });
  it('reads working hours on the Tunis clock', () => {
    const rules = [ruleOf('MONDAY', '08:00', '17:00')];

    // Monday 00:30 Tunis, still Sunday 23:30 in UTC.
    expect(isWorkingTime(new Date('2026-11-15T23:30:00.000Z'), rules, [])).toBe(false);
    // Monday 08:30 Tunis = 07:30 UTC.
    expect(isWorkingTime(new Date('2026-11-16T07:30:00.000Z'), rules, [])).toBe(true);
    // Monday 17:30 Tunis = 16:30 UTC, after closing.
    expect(isWorkingTime(new Date('2026-11-16T16:30:00.000Z'), rules, [])).toBe(false);
    // Sunday 23:30 UTC is NOT a Sunday working time either: it is Monday 00:30.
    expect(isWorkingTime(new Date('2026-11-15T23:30:00.000Z'), [ruleOf('SUNDAY', '08:00', '17:00')], [])).toBe(false);
  });

  it('applies a Tunis-dated BLOCK to the Tunis day of the instant', () => {
    const rules = [ruleOf('MONDAY', '00:00', '23:59')];
    const block = {
      id: 'b', exceptionDate: '2026-11-16', type: 'BLOCK' as const,
      startTime: '00:00', endTime: '01:00', reason: null,
    };

    expect(isWorkingTime(new Date('2026-11-15T23:30:00.000Z'), rules, [block])).toBe(false); // Monday 00:30 Tunis
    expect(isWorkingTime(new Date('2026-11-16T01:30:00.000Z'), rules, [block])).toBe(true); // Monday 02:30 Tunis
  });

  it('cuts the visible range into Tunis days for the exceptions API', () => {
    const range = toCalendarVisibleRange(
      new Date('2026-11-15T23:00:00.000Z'), // Monday 00:00 Tunis
      new Date('2026-11-22T23:00:00.000Z'), // next Monday 00:00 Tunis
    );

    expect(range.appointmentFrom).toBe('2026-11-15T23:00:00.000Z');
    expect(range.appointmentTo).toBe('2026-11-22T23:00:00.000Z');
    expect(range.exceptionFrom).toBe('2026-11-16');
    expect(range.exceptionToInclusive).toBe('2026-11-22');
  });

  it('titles periods with the Tunis dates', () => {
    expect(
      calendarPeriodTitle('week', new Date('2026-11-15T23:00:00.000Z'), new Date('2026-11-22T23:00:00.000Z')),
    ).toBe('16 – 22 nov. 2026');
    expect(calendarPeriodTitle('day', new Date('2026-11-15T23:00:00.000Z'), new Date('2026-11-16T23:00:00.000Z'))).toBe(
      'Lundi 16 novembre 2026',
    );
    expect(
      calendarPeriodTitle('month', new Date('2026-10-25T23:00:00.000Z'), new Date('2026-12-06T23:00:00.000Z')),
    ).toBe('Novembre 2026');
  });

  it('shows card times on the Tunis clock', () => {
    expect(
      formatCalendarTimeRange(new Date('2026-11-16T08:00:00.000Z'), new Date('2026-11-16T08:30:00.000Z')),
    ).toBe('09:00–09:30');
    expect(formatCalendarTime(new Date('2026-11-15T23:30:00.000Z'))).toBe('00:30');
  });

  it('hides weekdays by their Tunis weekday', () => {
    const week = {
      startMs: Date.parse('2026-11-15T23:00:00.000Z'),
      endMs: Date.parse('2026-11-22T23:00:00.000Z'),
    };
    // 23:30 UTC on Sunday is Monday in Tunis: Monday (1) is shown, Sunday (0) stays hidden.
    expect(weekdaysToHide([ruleOf('TUESDAY', '08:00', '17:00')], [Date.parse('2026-11-15T23:30:00.000Z')], week)).toEqual([
      0, 3, 4, 5, 6,
    ]);
  });
});

describe('CAL-FIX fix 2: business hours drawn on the grid', () => {
  it('keeps the pause inside the working segment, so no hatched sliver shows beside the break block', () => {
    const rules = [rule({ pauseStart: '12:30', pauseEnd: '14:00' }), rule({ dayOfWeek: 'SUNDAY', active: false })];
    expect(projectGridBusinessHours(rules)).toEqual([{ daysOfWeek: [1], startTime: '09:00', endTime: '17:00' }]);
    // Working-time decisions still cut the pause out.
    expect(projectBusinessHours(rules)).toHaveLength(2);
    expect(isWorkingTime(at('2026-11-16', '13:00'), rules, [])).toBe(false);
  });
});

describe('CAL-FIX-2 fix 5: first visible hour of the week', () => {
  it('reads the API « HH:mm:ss » times (07:00:00 opens the grid at 06:00, not the 08:00 default)', () => {
    expect(paddedSlotBounds([rule({ startTime: '07:00:00', endTime: '17:00:00' })])).toEqual({ min: '06:00:00', max: '18:00:00' });
    expect(isWorkingTime(at('2026-11-16', '07:30'), [rule({ startTime: '07:00:00', endTime: '17:00:00' })], [])).toBe(true);
  });

  it('widens the grid to show a loaded appointment outside the working hours (07:30 with hours from 09:00)', () => {
    const bounds = paddedSlotBounds([rule()], [], [
      { start: at('2026-11-16', '07:30').toISOString(), end: at('2026-11-16', '08:00').toISOString() },
    ]);
    expect(bounds.min).toBe('06:00:00');
    expect(bounds.max).toBe('18:00:00');
  });
});

