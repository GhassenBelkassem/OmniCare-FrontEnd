/**
 * Patient age labels in French, computed on calendar dates in the clinic time zone.
 * Under one year the age is shown in months, under one month in days, never « 0 an ».
 */
const DEFAULT_ZONE = 'Africa/Tunis';

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseDateValue(value: string | null | undefined): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? { year, month, day } : null;
}

function calendarDateIn(at: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function utc(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export interface PatientAge {
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

/** Full years, months and days between birth and `at`; null when unknown or in the future. */
export function patientAge(
  dateOfBirth: string | null | undefined,
  at: Date | string = new Date(),
  timeZone: string = DEFAULT_ZONE,
): PatientAge | null {
  const birth = parseDateValue(dateOfBirth);
  const reference = typeof at === 'string' ? new Date(at) : at;
  if (!birth || Number.isNaN(reference.getTime())) return null;
  const today = calendarDateIn(reference, timeZone);
  if (utc(birth) > utc(today)) return null;
  let totalMonths = (today.year - birth.year) * 12 + (today.month - birth.month);
  if (today.day < birth.day) totalMonths -= 1;
  const anchorMonth = birth.month - 1 + totalMonths;
  const anchorYear = birth.year + Math.floor(anchorMonth / 12);
  const anchorMonthIndex = ((anchorMonth % 12) + 12) % 12;
  const daysInAnchorMonth = new Date(Date.UTC(anchorYear, anchorMonthIndex + 1, 0)).getUTCDate();
  const anchor = Date.UTC(anchorYear, anchorMonthIndex, Math.min(birth.day, daysInAnchorMonth));
  const days = Math.round((utc(today) - anchor) / 86_400_000);
  return { years: Math.floor(totalMonths / 12), months: totalMonths, days };
}

/** « 34 ans », « 1 an », « 3 mois », « 11 jours », « 1 jour » ; null when unknown. */
export function patientAgeLabel(
  dateOfBirth: string | null | undefined,
  at: Date | string = new Date(),
  timeZone: string = DEFAULT_ZONE,
): string | null {
  const age = patientAge(dateOfBirth, at, timeZone);
  if (!age || age.years > 130) return null;
  if (age.years >= 1) return `${age.years} an${age.years > 1 ? 's' : ''}`;
  if (age.months >= 1) return `${age.months} mois`;
  return `${age.days} jour${age.days > 1 ? 's' : ''}`;
}

/** True when the date of birth is less than one year before `at` (likely a typo, or a baby). */
export function isRecentBirthDate(
  dateOfBirth: string | null | undefined,
  at: Date | string = new Date(),
  timeZone: string = DEFAULT_ZONE,
): boolean {
  const age = patientAge(dateOfBirth, at, timeZone);
  return age !== null && age.years < 1;
}
