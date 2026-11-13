/**
 * Contract of GET /api/v1/doctor/scheduled-care/day-slots?date=YYYY-MM-DD (agreed with the backend, G4-3).
 * Only the OPEN grid slots of the Tunis day are listed (the break and closed time are not). Times are
 * Tunis `HH:mm`, the end is exclusive. The state comes from the API as it is: the browser never decides
 * whether a slot is free, taken or past.
 */
export type DaySlotState = 'FREE' | 'TAKEN' | 'PAST';

export interface DaySlot {
  readonly start: string;
  readonly end: string;
  readonly state: DaySlotState;
}

export interface DaySlotsResponse {
  readonly timeZone: string;
  readonly date: string;
  readonly generatedAt: string;
  readonly slots: readonly DaySlot[];
}
