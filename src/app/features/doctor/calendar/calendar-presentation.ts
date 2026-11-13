import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';

/**
 * Calendar-only presentation layer. It maps a scheduled-care item to the design state shown on
 * the calendar. It is intentionally separate from `shared/ui/appointment-status.ts`, which stays the
 * mapping for the rest of the workspace (lists, home, drawers).
 */
export type CalendarState =
  | 'request'
  | 'waitingPatient'
  | 'upcoming'
  | 'followUpUpcoming'
  | 'inProgress'
  | 'done'
  | 'followUpDone'
  | 'absent'
  | 'cancelled'
  | 'neutral';

export type CalendarTypeIcon = 'cabinet' | 'external';

export interface CalendarPresentation {
  readonly state: CalendarState;
  readonly labelFr: string;
  /** Pending states are drawn with a dashed border. */
  readonly dashed: boolean;
  /** Cancelled appointments keep their slot visible, struck through. */
  readonly struck: boolean;
  readonly typeIcon: CalendarTypeIcon;
  /** Hook for `calendar-status-tokens.scss`. */
  readonly cssClass: string;
  /**
   * A confirmed appointment whose end is already past and that was never started: shown muted with
   * « Non clôturé », never « À venir ». The state stays the same so the filters keep working.
   */
  readonly notClosed: boolean;
}

export interface CalendarPresentationOptions {
  /** Follow-up marker, from the agenda item (`followUp`, backend G4-1). Defaults to false. */
  readonly isFollowUp?: boolean;
  /**
   * The current instant (epoch ms). When given, a CONFIRMED appointment whose end is before it is
   * « Non clôturé ». Without it nothing is derived from time.
   */
  readonly nowMs?: number;
}

export const NOT_CLOSED_LABEL = 'Non clôturé';
export const NOT_CLOSED_CLASS = 'oc-cal-state--not-closed';

export const CALENDAR_STATES: readonly CalendarState[] = [
  'request',
  'waitingPatient',
  'upcoming',
  'followUpUpcoming',
  'inProgress',
  'done',
  'followUpDone',
  'absent',
  'cancelled',
  'neutral',
];

const LABEL_FR: Readonly<Record<CalendarState, string>> = {
  request: 'Demande',
  waitingPatient: 'En attente du patient',
  upcoming: 'À venir',
  followUpUpcoming: 'Suivi à venir',
  inProgress: 'En cours',
  done: 'Terminé',
  followUpDone: 'Suivi terminé',
  absent: 'Absent',
  cancelled: 'Annulé',
  neutral: 'Rendez-vous',
};

const DASHED_STATES: ReadonlySet<CalendarState> = new Set<CalendarState>([
  'request',
  'waitingPatient',
]);

/** Never throws: any value outside the decided mapping falls back to the neutral state. */
export function presentCalendarItem(
  item: DoctorScheduledCareItem,
  opts: CalendarPresentationOptions = {},
): CalendarPresentation {
  const state = calendarStateOf(item.resourceType, item.status, opts.isFollowUp === true);
  const notClosed = isNotClosed(item, opts.nowMs);
  return {
    state,
    labelFr: notClosed ? NOT_CLOSED_LABEL : LABEL_FR[state],
    dashed: DASHED_STATES.has(state),
    struck: state === 'cancelled',
    typeIcon: item.subject?.subjectType === 'PRACTICE_PATIENT' ? 'external' : 'cabinet',
    cssClass: notClosed ? `oc-cal-state--${state} ${NOT_CLOSED_CLASS}` : `oc-cal-state--${state}`,
    notClosed,
  };
}

/** CONFIRMED appointment (never started) whose end instant is before `nowMs`. Instants compare the same in every zone. */
export function isNotClosed(item: Pick<DoctorScheduledCareItem, 'resourceType' | 'status' | 'end'>, nowMs: number | undefined): boolean {
  if (nowMs === undefined || item.resourceType !== 'APPOINTMENT' || item.status !== 'CONFIRMED') return false;
  const endMs = Date.parse(item.end ?? '');
  return Number.isFinite(endMs) && endMs <= nowMs;
}

function calendarStateOf(
  resourceType: string,
  status: string,
  isFollowUp: boolean,
): CalendarState {
  if (resourceType === 'BOOKING_REQUEST') {
    if (status === 'PENDING_DOCTOR') return 'request';
    if (status === 'PENDING_PATIENT_TIME_CONFIRMATION') return 'waitingPatient';
    return 'neutral';
  }
  if (resourceType === 'APPOINTMENT') {
    switch (status) {
      case 'PROPOSED':
        return 'waitingPatient';
      case 'CONFIRMED':
        return isFollowUp ? 'followUpUpcoming' : 'upcoming';
      case 'IN_PROGRESS':
        return 'inProgress';
      case 'COMPLETED':
        return isFollowUp ? 'followUpDone' : 'done';
      case 'NO_SHOW':
        return 'absent';
      case 'CANCELLED':
        return 'cancelled';
    }
  }
  return 'neutral';
}
