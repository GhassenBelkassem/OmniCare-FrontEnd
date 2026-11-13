import type { DaySlot, DaySlotsResponse } from '../calendar-day-slots.models';
import fixtureJson from './day-slots.fixture.json';

/**
 * The agreed contract fixture, as a fresh copy: Monday 2026-11-16 (working 08:00–12:30 and 14:00–18:00,
 * break 12:30–14:00, 16:00–17:00 closed). 15 slots: 5 TAKEN, 3 PAST, 7 FREE (3 runs once merged: 11:00–12:30, 14:30–16:00, 17:00–17:30).
 */
export function daySlotsFixture(): DaySlotsResponse {
  return structuredClone(fixtureJson) as unknown as DaySlotsResponse;
}

/** A fixture with its slot list replaced. */
export function daySlotsWith(slots: readonly DaySlot[]): DaySlotsResponse {
  return { ...daySlotsFixture(), slots };
}
