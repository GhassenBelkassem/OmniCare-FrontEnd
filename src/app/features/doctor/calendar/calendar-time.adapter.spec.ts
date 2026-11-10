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
  toCalendarVisibleRange,
  toFullCalendarWeekday,
} from './calendar-time.adapter';

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
    const range = toCalendarVisibleRange(new Date(2031, 3, 1), new Date(2031, 4, 1));
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
    expect(calendarPeriodTitle('week', new Date(2026, 10, 9), new Date(2026, 10, 16))).toBe(
      '9 – 15 nov. 2026',
    );
    expect(calendarPeriodTitle('week', new Date(2026, 10, 30), new Date(2026, 11, 7))).toBe(
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
    const monday = (hours: number) => new Date(2026, 10, 9, hours, 0);
    expect(isWorkingTime(monday(9), rules, [])).toBe(true);
    expect(isWorkingTime(monday(12), rules, [])).toBe(false);
    expect(isWorkingTime(monday(18), rules, [])).toBe(false);
    expect(isWorkingTime(new Date(2026, 10, 10, 9), rules, [])).toBe(false);
    const block = {
      id: 'b', exceptionDate: '2026-11-09', type: 'BLOCK' as const,
      startTime: '08:00', endTime: '10:00', reason: null,
    };
    expect(isWorkingTime(monday(9), rules, [block])).toBe(false);
    const extra = { ...block, id: 'e', type: 'EXTRA' as const, startTime: '18:00', endTime: '19:00' };
    expect(isWorkingTime(monday(18), rules, [extra])).toBe(true);
  });
});
