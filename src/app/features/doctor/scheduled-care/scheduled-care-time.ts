export const SCHEDULING_TIMEZONE = 'Africa/Tunis';

export function formatScheduledInstant(
  instant: string,
  timezone = SCHEDULING_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function formatScheduledRange(
  start: string,
  end: string,
  timezone = SCHEDULING_TIMEZONE,
): string {
  return `${formatScheduledInstant(start, timezone)} — ${formatScheduledInstant(end, timezone, {
    year: undefined,
    month: undefined,
    day: undefined,
  })}`;
}
