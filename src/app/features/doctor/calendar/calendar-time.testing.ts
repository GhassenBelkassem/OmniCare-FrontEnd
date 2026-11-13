import { tunisInstant } from './calendar-time';

/**
 * Test helper: the instant of a Tunis wall clock, so specs mean the same thing in any time zone
 * of the machine that runs them. `at('2031-04-07', '09:30')` is 7 April 2031, 09:30 in Tunis.
 */
export function at(dayKey: string, time = '00:00'): Date {
  const instant = tunisInstant(dayKey, time);
  if (instant === null) throw new Error(`Invalid Tunis date or time: ${dayKey} ${time}`);
  return instant;
}
