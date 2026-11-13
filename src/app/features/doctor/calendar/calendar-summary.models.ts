/**
 * Contract of GET /api/v1/doctor/scheduled-care/calendar-summary (agreed with the backend, G4-2b).
 * Tunis dates `YYYY-MM-DD`, times Tunis `HH:mm` (end exclusive). Every value below comes from the API
 * as it is: the browser never recomputes the level, the load percentage or the slot counts.
 */
export type CalendarDayLevel = 'AVAILABLE' | 'BUSY' | 'FULL' | 'CLOSED';
export type CalendarClosedReason = 'WEEKLY_OFF' | 'EXCEPTION';

export interface CalendarTimeWindow {
  readonly start: string;
  readonly end: string;
}

export interface CalendarSummaryThresholds {
  readonly busyFromPercent: number;
  readonly fullFromPercent: number;
}

export interface CalendarSummaryCountsByStatus {
  readonly CONFIRMED?: number;
  readonly IN_PROGRESS?: number;
  readonly COMPLETED?: number;
  readonly NO_SHOW?: number;
  readonly CANCELLED?: number;
  readonly PROPOSED?: number;
}

export interface CalendarSummaryFollowUpCounts {
  readonly CONFIRMED?: number;
  readonly COMPLETED?: number;
}

export interface CalendarSummaryDay {
  readonly date: string;
  readonly level: CalendarDayLevel;
  readonly closedReason: CalendarClosedReason | null;
  readonly workingSegments: readonly CalendarTimeWindow[];
  readonly breakWindow: CalendarTimeWindow | null;
  readonly blockedWindows: readonly CalendarTimeWindow[];
  readonly extraWindows: readonly CalendarTimeWindow[];
  readonly bookableSlots: number;
  readonly takenSlots: number;
  /** Integer 0–100, `null` when `bookableSlots` is 0. */
  readonly loadPercent: number | null;
  readonly countsByStatus: CalendarSummaryCountsByStatus;
  readonly followUpCountsByStatus: CalendarSummaryFollowUpCounts;
  readonly pendingRequestCount: number;
  readonly awaitingPatientRequestCount: number;
}

export interface CalendarSummary {
  readonly timeZone: string;
  readonly from: string;
  readonly to: string;
  readonly thresholds: CalendarSummaryThresholds;
  readonly days: readonly CalendarSummaryDay[];
}
