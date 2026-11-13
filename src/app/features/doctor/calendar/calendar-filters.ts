import type { CalendarState } from './calendar-presentation';

export interface CalendarFilterOption {
  readonly state: CalendarState;
  readonly label: string;
}

/** The states the doctor can show or hide, in the order of the « Filtres » list. */
export const CALENDAR_FILTER_OPTIONS: readonly CalendarFilterOption[] = [
  { state: 'upcoming', label: 'À venir' },
  { state: 'followUpUpcoming', label: 'Suivi à venir' },
  { state: 'inProgress', label: 'En cours' },
  { state: 'done', label: 'Terminé' },
  { state: 'followUpDone', label: 'Suivi terminé' },
  { state: 'request', label: 'Demande' },
  { state: 'waitingPatient', label: 'En attente du patient' },
  { state: 'absent', label: 'Absent' },
  { state: 'cancelled', label: 'Annulé' },
];

/** A state is shown unless the doctor switched it off. Any other state (« Rendez-vous ») is always shown. */
export function isStateVisible(state: CalendarState | undefined, hidden: ReadonlySet<CalendarState>): boolean {
  return state === undefined || !hidden.has(state);
}
