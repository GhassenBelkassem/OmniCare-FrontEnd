import { describe, expect, it } from 'vitest';

import { CALENDAR_FILTER_OPTIONS, isStateVisible } from './calendar-filters';
import { CALENDAR_STATES, type CalendarState } from './calendar-presentation';

describe('calendar filters', () => {
  it('lists the nine states of the canvas, in French, once each', () => {
    expect(CALENDAR_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'À venir',
      'Suivi à venir',
      'En cours',
      'Terminé',
      'Suivi terminé',
      'Demande',
      'En attente du patient',
      'Absent',
      'Annulé',
    ]);
    const states = CALENDAR_FILTER_OPTIONS.map((option) => option.state);
    expect(new Set(states).size).toBe(9);
    expect(states.every((state) => CALENDAR_STATES.includes(state))).toBe(true);
  });

  it('shows everything by default', () => {
    for (const option of CALENDAR_FILTER_OPTIONS) {
      expect(isStateVisible(option.state, new Set())).toBe(true);
    }
  });

  it('hides exactly the states that are switched off', () => {
    const hidden = new Set<CalendarState>(['cancelled', 'done']);

    expect(isStateVisible('cancelled', hidden)).toBe(false);
    expect(isStateVisible('done', hidden)).toBe(false);
    expect(isStateVisible('upcoming', hidden)).toBe(true);
    expect(isStateVisible('request', hidden)).toBe(true);
  });

  it('always shows the neutral « Rendez-vous » and an unknown state', () => {
    expect(isStateVisible('neutral', new Set<CalendarState>(['cancelled']))).toBe(true);
    expect(isStateVisible(undefined, new Set<CalendarState>(['cancelled']))).toBe(true);
  });
});
