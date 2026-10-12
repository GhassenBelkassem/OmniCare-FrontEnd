import type {
  AvailabilityExceptionDto,
  AvailabilityRuleDto,
  DayOfWeekDto,
} from '../appointment-api.models';

export interface CalendarVisibleRange {
  readonly key: string;
  readonly appointmentFrom: string;
  readonly appointmentTo: string;
  readonly exceptionFrom: string;
  readonly exceptionToInclusive: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface CalendarBusinessHoursSegment {
  readonly daysOfWeek: readonly number[];
  readonly startTime: string;
  readonly endTime: string;
}

const FULLCALENDAR_WEEKDAY: Readonly<Record<DayOfWeekDto, number>> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Presentation-only conversion boundary. It does not redefine backend timezone semantics. */
export function toCalendarVisibleRange(start: Date, endExclusive: Date): CalendarVisibleRange {
  const appointmentFrom = start.toISOString();
  const appointmentTo = endExclusive.toISOString();
  const inclusiveExceptionEnd = new Date(endExclusive.getTime() - 1);

  return {
    key: `${appointmentFrom}|${appointmentTo}`,
    appointmentFrom,
    appointmentTo,
    exceptionFrom: toLocalDateOnly(start),
    exceptionToInclusive: toLocalDateOnly(inclusiveExceptionEnd),
    startMs: start.getTime(),
    endMs: endExclusive.getTime(),
  };
}

/** Appointment values are instants and must reach FullCalendar byte-for-byte unchanged. */
export function preserveAppointmentInstant(value: string): string {
  return value;
}

export function addEstimatedMinutesToInstant(value: string, minutes: number): string | null {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return new Date(instant.getTime() + minutes * 60_000).toISOString();
}

/** Weekly times are backend wall-clock values. No zone conversion is applied. */
export function preserveWallClockTime(value: string): string {
  return value;
}

export function toFullCalendarWeekday(day: DayOfWeekDto): number {
  return FULLCALENDAR_WEEKDAY[day];
}

export function projectBusinessHours(
  rules: readonly AvailabilityRuleDto[],
): CalendarBusinessHoursSegment[] {
  return rules.flatMap((rule) => {
    if (!rule.active) return [];

    const base = { daysOfWeek: [toFullCalendarWeekday(rule.dayOfWeek)] as readonly number[] };
    if (hasValidPause(rule)) {
      return [
        {
          ...base,
          startTime: preserveWallClockTime(rule.startTime),
          endTime: preserveWallClockTime(rule.pauseStart),
        },
        {
          ...base,
          startTime: preserveWallClockTime(rule.pauseEnd),
          endTime: preserveWallClockTime(rule.endTime),
        },
      ];
    }

    return [
      {
        ...base,
        startTime: preserveWallClockTime(rule.startTime),
        endTime: preserveWallClockTime(rule.endTime),
      },
    ];
  });
}

/**
 * Dates whose BLOCK intervals cover every effective working segment.
 * Pauses are excluded from the working segments, and adjacent BLOCK rows may
 * jointly cover a day. Closed weekdays and partial blocks are not classified
 * as full-day blocks.
 */
export function fullyBlockedDateKeys(
  rules: readonly AvailabilityRuleDto[],
  exceptions: readonly AvailabilityExceptionDto[],
): ReadonlySet<string> {
  const activeRulesByWeekday = new Map<number, AvailabilityRuleDto>();
  for (const rule of rules) {
    if (rule.active) activeRulesByWeekday.set(toFullCalendarWeekday(rule.dayOfWeek), rule);
  }

  const blocksByDate = new Map<string, readonly AvailabilityExceptionDto[]>();
  for (const exception of exceptions) {
    if (exception.type !== 'BLOCK') continue;
    const existing = blocksByDate.get(exception.exceptionDate) ?? [];
    blocksByDate.set(exception.exceptionDate, [...existing, exception]);
  }

  const result = new Set<string>();
  for (const [dateKey, blocks] of blocksByDate) {
    const date = localDateFromKey(dateKey);
    const rule = date === null ? undefined : activeRulesByWeekday.get(date.getDay());
    if (rule === undefined) continue;

    const workingSegments = projectBusinessHours([rule]).map((segment) => ({
      start: minutesOfDay(segment.startTime),
      end: minutesOfDay(segment.endTime),
    }));
    const blockSegments = blocks
      .map((block) => ({
        start: minutesOfDay(block.startTime),
        end: minutesOfDay(block.endTime),
      }))
      .filter((segment) => segment.start !== null && segment.end !== null)
      .map((segment) => ({ start: segment.start!, end: segment.end! }))
      .sort((left, right) => left.start - right.start);

    if (
      workingSegments.length > 0 &&
      workingSegments.every(
        (segment) =>
          segment.start !== null &&
          segment.end !== null &&
          intervalIsCovered(segment.start, segment.end, blockSegments),
      )
    ) {
      result.add(dateKey);
    }
  }
  return result;
}

/** Combines DATE ONLY and WALL CLOCK without introducing a timezone offset. */
export function exceptionWallClockDateTime(date: string, time: string): string {
  return `${date}T${preserveWallClockTime(time)}:00`;
}

export function formatCalendarTime(value: Date | null): string {
  return value === null || Number.isNaN(value.getTime()) ? '' : EVENT_TIME_FORMATTER.format(value);
}

export function formatCalendarTimeRange(start: Date | null, end: Date | null): string {
  const startLabel = formatCalendarTime(start);
  const endLabel = formatCalendarTime(end);
  return endLabel ? `${startLabel}–${endLabel}` : startLabel;
}

export function toLocalDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateFromKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function intervalIsCovered(
  start: number,
  end: number,
  coverage: readonly { readonly start: number; readonly end: number }[],
): boolean {
  if (start >= end) return false;
  let cursor = start;
  for (const interval of coverage) {
    if (interval.end <= cursor) continue;
    if (interval.start > cursor) return false;
    cursor = Math.max(cursor, interval.end);
    if (cursor >= end) return true;
  }
  return false;
}

function hasValidPause(
  rule: AvailabilityRuleDto,
): rule is AvailabilityRuleDto & { readonly pauseStart: string; readonly pauseEnd: string } {
  return (
    rule.pauseStart !== null &&
    rule.pauseEnd !== null &&
    rule.startTime < rule.pauseStart &&
    rule.pauseStart < rule.pauseEnd &&
    rule.pauseEnd < rule.endTime
  );
}
