import { describe, expect, it } from 'vitest';

import type { AvailabilityExceptionDto, AvailabilityRuleDto } from '../appointment-api.models';
import {
  addEstimatedMinutesToInstant,
  exceptionWallClockDateTime,
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
