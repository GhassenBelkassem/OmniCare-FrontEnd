import type { CalendarSummary, CalendarSummaryDay } from '../calendar-summary.models';
import fixtureJson from './calendar-summary.fixture.json';

/** The agreed contract fixture (42 days, Monday 2026-10-26 to Sunday 2026-12-06), as a fresh copy. */
export function summaryFixture(): CalendarSummary {
  return structuredClone(fixtureJson) as unknown as CalendarSummary;
}

/** One day of the fixture. */
export function fixtureDay(date: string): CalendarSummaryDay {
  const day = summaryFixture().days.find((candidate) => candidate.date === date);
  if (day === undefined) throw new Error(`No fixture day ${date}`);
  return day;
}

/** A fixture day with some fields replaced. */
export function dayWith(date: string, overrides: Partial<CalendarSummaryDay>): CalendarSummaryDay {
  return { ...fixtureDay(date), ...overrides };
}

/**
 * A closed EXCEPTION day exactly as the backend sends it (G4-2b report, sample 2027-01-06, moved to `date`):
 * the day is CLOSED but still carries its working segment and the blocked window.
 */
export function backendClosedExceptionDay(date: string): CalendarSummaryDay {
  return {
    date,
    level: 'CLOSED',
    closedReason: 'EXCEPTION',
    workingSegments: [{ start: '09:00', end: '10:00' }],
    breakWindow: null,
    blockedWindows: [{ start: '09:00', end: '10:00' }],
    extraWindows: [],
    bookableSlots: 0,
    takenSlots: 0,
    loadPercent: null,
    countsByStatus: { CONFIRMED: 0, IN_PROGRESS: 0, COMPLETED: 0, NO_SHOW: 0, CANCELLED: 0, PROPOSED: 0 },
    followUpCountsByStatus: { CONFIRMED: 0, COMPLETED: 0 },
    pendingRequestCount: 0,
    awaitingPatientRequestCount: 0,
  };
}

