/**
 * The one place where the doctor calendar reads or builds a time of day.
 *
 * Project invariant: every time shown or sent by the calendar is **Africa/Tunis** time, whatever time
 * zone the doctor's computer uses. Nothing else in `calendar/` may call `getHours`, `getDay`,
 * `getDate`, `new Date(y, m, d)`, `setHours`, `toLocale…` without a time zone, and the like: those use the
 * browser's zone. The IANA zone is used (never a fixed `+01:00`), so a future change of Tunisian
 * rules would be followed automatically.
 *
 * A « day key » is a Tunis calendar date written `YYYY-MM-DD`. Instants are plain `Date`s (UTC
 * milliseconds); only their reading in Tunis differs from the browser.
 */
export const TUNIS_TIME_ZONE = 'Africa/Tunis';

const PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TUNIS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface TunisParts {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

type InstantInput = Date | number | string;

function toMs(value: InstantInput): number {
  return value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
}

/** Calendar and clock fields of an instant, read in Tunis. `null` for an invalid instant. */
export function tunisParts(value: InstantInput): TunisParts | null {
  const ms = toMs(value);
  if (!Number.isFinite(ms)) return null;
  const fields: Record<string, number> = {};
  for (const part of PARTS_FORMATTER.formatToParts(new Date(ms))) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return {
    year: fields['year'] ?? NaN,
    month: fields['month'] ?? NaN,
    day: fields['day'] ?? NaN,
    hour: fields['hour'] ?? NaN,
    minute: fields['minute'] ?? NaN,
    second: fields['second'] ?? NaN,
  };
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Tunis calendar date of an instant, as `YYYY-MM-DD`. Empty string for an invalid instant. */
export function tunisDayKey(value: InstantInput): string {
  const parts = tunisParts(value);
  return parts === null ? '' : `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Today in Tunis. */
export function tunisToday(now: InstantInput = new Date()): string {
  return tunisDayKey(now);
}

/** Hour, minute and minutes since Tunis midnight of an instant. */
export function tunisHourMinute(value: InstantInput): {
  readonly hour: number;
  readonly minute: number;
  readonly minutes: number;
} {
  const parts = tunisParts(value);
  const hour = parts?.hour ?? NaN;
  const minute = parts?.minute ?? NaN;
  return { hour, minute, minutes: hour * 60 + minute };
}

/** Weekday of a Tunis calendar date: 0 = Sunday … 6 = Saturday. `null` for an invalid key. */
export function weekdayOfDayKey(key: string): number | null {
  const date = utcDateOfKey(key);
  return date === null ? null : date.getUTCDay();
}

/** Weekday of an instant in Tunis: 0 = Sunday … 6 = Saturday. `null` for an invalid instant. */
export function tunisWeekday(value: InstantInput): number | null {
  return weekdayOfDayKey(tunisDayKey(value));
}

/** The date `days` after (or before) a day key. Pure calendar arithmetic, no zone involved. */
export function addDaysToKey(key: string, days: number): string {
  const date = utcDateOfKey(key);
  if (date === null) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The instant at which a Tunis wall clock (`dayKey` + `HH:mm` or `HH:mm:ss`) occurs. `null` for an invalid
 * date or time. Computed from the IANA zone, so an offset is never written by hand.
 */
export function tunisInstant(dayKey: string, time = '00:00'): Date | null {
  const date = DAY_KEY.exec(dayKey);
  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (date === null || clock === null || utcDateOfKey(dayKey) === null) return null;
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const second = Number(clock[3] ?? 0);
  if (hour > 24 || minute > 59 || second > 59 || (hour === 24 && (minute > 0 || second > 0))) return null;
  const wallAsUtc = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour, minute, second);
  // Two passes: the offset is read at the guess, then again at the corrected instant.
  let instant = wallAsUtc - tunisOffsetMs(wallAsUtc);
  instant = wallAsUtc - tunisOffsetMs(instant);
  return new Date(instant);
}

/** Midnight to midnight of a Tunis day: `[start, end)` as instants. */
export function tunisDayBounds(dayKey: string): { readonly start: Date; readonly end: Date } | null {
  const start = tunisInstant(dayKey, '00:00');
  const end = tunisInstant(addDaysToKey(dayKey, 1), '00:00');
  return start === null || end === null ? null : { start, end };
}

export interface TunisWeekRange {
  /** Monday, `YYYY-MM-DD`. */
  readonly startKey: string;
  /** The following Monday (exclusive end, i.e. Sunday 24:00), `YYYY-MM-DD`. */
  readonly endKey: string;
  /** Monday 00:00 Tunis. */
  readonly start: Date;
  /** Next Monday 00:00 Tunis (= Sunday 24:00). */
  readonly end: Date;
}

/** Monday 00:00 → Sunday 24:00 (Tunis) of the week that contains the given instant or day key. */
export function tunisWeekRange(value: InstantInput): TunisWeekRange | null {
  const key = typeof value === 'string' && DAY_KEY.test(value) ? value : tunisDayKey(value);
  const weekday = weekdayOfDayKey(key);
  if (weekday === null) return null;
  const startKey = addDaysToKey(key, -((weekday + 6) % 7));
  const endKey = addDaysToKey(startKey, 7);
  const start = tunisInstant(startKey, '00:00');
  const end = tunisInstant(endKey, '00:00');
  return start === null || end === null ? null : { startKey, endKey, start, end };
}

// ---- French formatting, always in Tunis ----

const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TUNIS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** « 09:30 » in Tunis. Empty string for a missing or invalid instant. */
export function formatTunisTime(value: Date | null): string {
  return value === null || Number.isNaN(value.getTime()) ? '' : TIME_FORMATTER.format(value);
}

/** « 09:30–10:00 » in Tunis. */
export function formatTunisTimeRange(start: Date | null, end: Date | null): string {
  const startLabel = formatTunisTime(start);
  const endLabel = formatTunisTime(end);
  return endLabel ? `${startLabel}–${endLabel}` : startLabel;
}

/** A `fr-FR` formatter fixed to Tunis; `options` choose the fields. */
export function tunisFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: TUNIS_TIME_ZONE });
}

// ---- internals ----

function utcDateOfKey(key: string): Date | null {
  const match = DAY_KEY.exec(key);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

/** Offset of Tunis from UTC (milliseconds, positive east) at an instant. */
function tunisOffsetMs(instantMs: number): number {
  const parts = tunisParts(instantMs);
  if (parts === null) return 0;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}
