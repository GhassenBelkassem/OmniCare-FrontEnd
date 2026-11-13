import type {
  AvailabilityExceptionDto,
  AvailabilityRuleDto,
  DayOfWeekDto,
} from '../appointment-api.models';
import {
  formatTunisTime,
  formatTunisTimeRange,
  tunisDayKey,
  tunisFormatter,
  tunisHourMinute,
  tunisParts,
  tunisWeekday,
  weekdayOfDayKey,
} from './calendar-time';

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

/**
 * The visible period as the API wants it: appointments as instants (ISO), exceptions as Tunis dates
 * (`YYYY-MM-DD`, the backend reads them in Africa/Tunis). `start` / `endExclusive` are instants.
 */
export function toCalendarVisibleRange(start: Date, endExclusive: Date): CalendarVisibleRange {
  const appointmentFrom = start.toISOString();
  const appointmentTo = endExclusive.toISOString();
  const inclusiveExceptionEnd = new Date(endExclusive.getTime() - 1);

  return {
    key: `${appointmentFrom}|${appointmentTo}`,
    appointmentFrom,
    appointmentTo,
    exceptionFrom: tunisDayKey(start),
    exceptionToInclusive: tunisDayKey(inclusiveExceptionEnd),
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
 * Business hours as DRAWN on the time grid (CAL-FIX fix 2): one segment per active rule, from start to end,
 * the pause included. The lunch break has its own « Pause déjeuner » block over exactly that time, so the
 * hatched « hors horaires » background must not show beside it (it left a thin striped sliver next to the
 * block). Working-time decisions keep using `projectBusinessHours`, which still cuts the pause out.
 */
export function projectGridBusinessHours(
  rules: readonly AvailabilityRuleDto[],
): CalendarBusinessHoursSegment[] {
  return rules
    .filter((rule) => rule.active)
    .map((rule) => ({
      daysOfWeek: [toFullCalendarWeekday(rule.dayOfWeek)] as readonly number[],
      startTime: preserveWallClockTime(rule.startTime),
      endTime: preserveWallClockTime(rule.endTime),
    }));
}

/**
 * Weekdays (0 = Sunday … 6 = Saturday) the week view hides: those with no active weekly rule AND
 * no appointment starting inside the visible range. Display logic on already-loaded data only.
 * Returns an empty list when nothing would be shown, because FullCalendar throws when all seven
 * days are hidden.
 */
export function weekdaysToHide(
  rules: readonly AvailabilityRuleDto[],
  appointmentStartMs: readonly number[],
  range: { readonly startMs: number; readonly endMs: number } | null,
): number[] {
  const shown = new Set<number>();
  for (const rule of rules) {
    if (rule.active) shown.add(toFullCalendarWeekday(rule.dayOfWeek));
  }
  if (range !== null) {
    for (const startMs of appointmentStartMs) {
      if (Number.isFinite(startMs) && startMs >= range.startMs && startMs < range.endMs) {
        const weekday = tunisWeekday(startMs);
        if (weekday !== null) shown.add(weekday);
      }
    }
  }
  if (shown.size === 0) return [];
  return [0, 1, 2, 3, 4, 5, 6].filter((weekday) => !shown.has(weekday));
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
    const weekday = weekdayOfDayKey(dateKey);
    const rule = weekday === null ? undefined : activeRulesByWeekday.get(weekday);
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

/** « 09:30 » in Tunis, whatever the browser's time zone. */
export function formatCalendarTime(value: Date | null): string {
  return formatTunisTime(value);
}

/** « 09:30–10:00 » in Tunis. */
export function formatCalendarTimeRange(start: Date | null, end: Date | null): string {
  return formatTunisTimeRange(start, end);
}

/**
 * Minutes of a wall-clock time. The API sends `LocalTime` as « HH:mm:ss » (Spring/Jackson) and older
 * fixtures use « HH:mm »: both are read (CAL-FIX-2 fix 5: « 07:00:00 » used to be dropped, so the grid fell
 * back to its 08:00 default).
 */
function minutesOfDay(value: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value ?? '');
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

export function hasValidPause(
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

/**
 * Visible time-grid range: earliest opening − 1 h to latest closing + 1 h (within the day). The loaded
 * appointments and requests of the visible period widen it too (CAL-FIX-2 fix 5), so a 07:30 appointment
 * is always on the grid even when the working hours start later.
 */
export function paddedSlotBounds(
  rules: readonly AvailabilityRuleDto[],
  exceptions: readonly AvailabilityExceptionDto[] = [],
  items: readonly { readonly start: string; readonly end: string }[] = [],
): { readonly min: string; readonly max: string } {
  const itemWindows = items.flatMap((item): [number, number][] => {
    const start = tunisHourMinute(item.start).minutes;
    const end = tunisHourMinute(item.end).minutes;
    if (!Number.isFinite(start)) return [];
    // An item that ends on the next Tunis day (or at midnight) keeps the grid open to the end of the day.
    const sameDay = tunisDayKey(item.start) === tunisDayKey(item.end) && Number.isFinite(end) && end > start;
    return [[start, sameDay ? end : 24 * 60]];
  });
  const scheduleWindows = [
    ...rules.filter((rule) => rule.active).map((rule) => [rule.startTime, rule.endTime]),
    ...exceptions
      .filter((exception) => exception.type === 'EXTRA')
      .map((exception) => [exception.startTime, exception.endTime]),
  ]
    .map(([start, end]) => [minutesOfDay(start), minutesOfDay(end)])
    .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
  if (scheduleWindows.length === 0 && itemWindows.length === 0) return { min: '08:00:00', max: '18:00:00' };
  // Items only widen the grid: without a schedule, the 08:00 – 18:00 default (09:00 – 17:00 padded) stays.
  const windows = [...(scheduleWindows.length === 0 ? [[9 * 60, 17 * 60] as [number, number]] : scheduleWindows), ...itemWindows];
  const earliest = Math.min(...windows.map(([start]) => start));
  const latest = Math.max(...windows.map(([, end]) => end));
  return {
    min: minutesToClock(Math.max(0, Math.floor((earliest - 60) / 60) * 60)),
    max: minutesToClock(Math.min(24 * 60, Math.ceil((latest + 60) / 60) * 60)),
  };
}

/** Consultation slot length from the doctor's active rules (shortest), default 20 min. */
export function consultationSlotMinutes(rules: readonly AvailabilityRuleDto[]): number {
  const durations = rules
    .filter((rule) => rule.active && rule.slotDurationMinutes > 0)
    .map((rule) => rule.slotDurationMinutes);
  return durations.length === 0 ? 20 : Math.min(...durations);
}

export function minutesToDuration(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

/**
 * True when the instant, read as a Tunis wall clock, falls inside the doctor's working hours for
 * that Tunis date: weekly rules (pauses excluded), minus BLOCK exceptions, plus EXTRA openings.
 */
export function isWorkingTime(
  instant: Date,
  rules: readonly AvailabilityRuleDto[],
  exceptions: readonly AvailabilityExceptionDto[],
): boolean {
  const dateKey = tunisDayKey(instant);
  const minute = tunisHourMinute(instant).minutes;
  const inside = (start: string, end: string): boolean => {
    const from = minutesOfDay(start);
    const to = minutesOfDay(end);
    return from !== null && to !== null && minute >= from && minute < to;
  };
  const sameDay = exceptions.filter((exception) => exception.exceptionDate === dateKey);
  if (sameDay.some((exception) => exception.type === 'BLOCK' && inside(exception.startTime, exception.endTime))) {
    return false;
  }
  if (sameDay.some((exception) => exception.type === 'EXTRA' && inside(exception.startTime, exception.endTime))) {
    return true;
  }
  const weekday = tunisWeekday(instant);
  if (weekday === null) return false;
  return projectBusinessHours(rules).some(
    (segment) => segment.daysOfWeek.includes(weekday) && inside(segment.startTime, segment.endTime),
  );
}

const DAY = tunisFormatter({ day: 'numeric' });
const MONTH_SHORT = tunisFormatter({ month: 'short' });
const YEAR = tunisFormatter({ year: 'numeric' });

/** French period title: « 9 – 15 nov. 2026 », « novembre 2026 », « lundi 9 novembre 2026 ». */
export function calendarPeriodTitle(
  mode: 'day' | 'week' | 'month',
  start: Date,
  endExclusive: Date,
): string {
  if (mode === 'day') {
    return capitalizeFirst(
      tunisFormatter({
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(start),
    );
  }
  if (mode === 'month') {
    // The month grid starts in the previous month; title the month in the middle.
    const middle = new Date((start.getTime() + endExclusive.getTime()) / 2);
    return capitalizeFirst(
      tunisFormatter({ month: 'long', year: 'numeric' }).format(middle),
    );
  }
  const end = new Date(endExclusive.getTime() - 1);
  const startParts = tunisParts(start);
  const endParts = tunisParts(end);
  const sameYear = startParts?.year === endParts?.year;
  const sameMonth = sameYear && startParts?.month === endParts?.month;
  if (sameMonth) {
    return `${DAY.format(start)} – ${DAY.format(end)} ${MONTH_SHORT.format(end)} ${YEAR.format(end)}`;
  }
  if (sameYear) {
    return `${DAY.format(start)} ${MONTH_SHORT.format(start)} – ${DAY.format(end)} ${MONTH_SHORT.format(end)} ${YEAR.format(end)}`;
  }
  return `${DAY.format(start)} ${MONTH_SHORT.format(start)} ${YEAR.format(start)} – ${DAY.format(end)} ${MONTH_SHORT.format(end)} ${YEAR.format(end)}`;
}

function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}
