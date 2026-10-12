import { describe, expect, it } from 'vitest';

import type { AvailabilityRuleDto } from './appointment-api.models';
import {
  fullWorkingDayWindow,
  wallClockMinute,
  weekdayForIsoDate,
} from './availability-exception.adapter';

const FRIDAY_RULE: AvailabilityRuleDto = {
  dayOfWeek: 'FRIDAY',
  active: true,
  startTime: '09:00:00',
  endTime: '15:00:00',
  pauseStart: '13:00:00',
  pauseEnd: '13:30:00',
  slotDurationMinutes: 30,
};

describe('availability exception wall-clock adapter', () => {
  it('maps an ISO date to its weekday without applying the browser timezone', () => {
    expect(weekdayForIsoDate('2026-10-09')).toBe('FRIDAY');
    expect(weekdayForIsoDate('2026-10-10')).toBe('SATURDAY');
    expect(weekdayForIsoDate('not-a-date')).toBeNull();
  });

  it('derives a full-working-day window from the active weekly rule', () => {
    expect(fullWorkingDayWindow([FRIDAY_RULE], '2026-10-09')).toEqual({
      startTime: '09:00',
      endTime: '15:00',
    });
  });

  it('does not invent calendar-day bounds for a closed weekday', () => {
    expect(fullWorkingDayWindow([FRIDAY_RULE], '2026-10-10')).toBeNull();
  });

  it('normalizes API LocalTime seconds without converting the wall clock', () => {
    expect(wallClockMinute('13:30:00')).toBe('13:30');
  });
});
