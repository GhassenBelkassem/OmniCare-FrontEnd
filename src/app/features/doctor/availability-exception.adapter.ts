import type { AvailabilityRuleDto, DayOfWeekDto } from './appointment-api.models';

export type AvailabilityExceptionScope = 'FULL_DAY' | 'TIME_WINDOW';

export interface AvailabilityExceptionWindow {
  readonly startTime: string;
  readonly endTime: string;
}

const DAYS_BY_JS_INDEX: readonly DayOfWeekDto[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function wallClockMinute(value: string): string {
  return value.substring(0, 5);
}

export function weekdayForIsoDate(date: string): DayOfWeekDto | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }
  return DAYS_BY_JS_INDEX[utcDate.getUTCDay()] ?? null;
}

export function fullWorkingDayWindow(
  rules: readonly AvailabilityRuleDto[],
  date: string,
): AvailabilityExceptionWindow | null {
  const weekday = weekdayForIsoDate(date);
  if (weekday === null) return null;
  const rule = rules.find((candidate) => candidate.dayOfWeek === weekday && candidate.active);
  if (!rule) return null;
  return {
    startTime: wallClockMinute(rule.startTime),
    endTime: wallClockMinute(rule.endTime),
  };
}
