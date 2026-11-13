import type { CalendarOptions, EventInput } from '@fullcalendar/angular';

import type { CalendarFilterOption } from './calendar-filters';
import type { CalendarState } from './calendar-presentation';
import type { CalendarSearchOutcome } from './calendar-search';
import type { BlockException } from './calendar-day.model';
import type { DaySlot } from './calendar-day-slots.models';
import type { CalendarSummary, CalendarSummaryDay } from './calendar-summary.models';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CalendarDaySummary {
  readonly appointmentCountLabel: string;
  readonly appointmentCountHint: string;
  readonly availabilityLabel: string;
  readonly availabilityHint: string;
  readonly workingHoursLabel: string;
  readonly workingHoursHint: string;
}

export interface CalendarViewModel {
  readonly viewMode: CalendarViewMode;
  readonly visibleTitle: string;
  readonly visibleSubtitle: string;
  readonly weekNumber: string;
  readonly selectedAppointmentId: string | null;
  readonly panelOpen: boolean;
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly rulesError: string | null;
  readonly exceptionsError: string | null;
  readonly mutationError: string | null;
  /** Transient French hint after clicking a past or non-working slot. */
  readonly slotHint?: string | null;
  readonly noSchedule: boolean;
  readonly realtimeDeferred: boolean;
  readonly ariaBusy: boolean;
  readonly daySummary: CalendarDaySummary | null;
  readonly notice: string | null;
  readonly quickBookingEnabled: boolean;
  /** « Mode discret »: initials instead of patient names on the cards. Optional (off when absent). */
  readonly discreet?: boolean;
  /** First Tunis day of the visible period, `YYYY-MM-DD` (the date picker opens on it). */
  readonly currentDate?: string;
  /** Search over the loaded period: the typed text and its outcome. */
  readonly searchQuery?: string;
  readonly search?: CalendarSearchOutcome;
  /** « Filtres »: the states, whether each is shown, and how many are switched off. */
  readonly filters?: readonly (CalendarFilterOption & { readonly visible: boolean })[];
  readonly hiddenFilterCount?: number;
  /** Single-key shortcuts switched on (default). */
  readonly shortcutsEnabled?: boolean;
}

export type CalendarViewAction =
  | { readonly kind: 'SET_VIEW'; readonly value: CalendarViewMode }
  | { readonly kind: 'PREVIOUS' }
  | { readonly kind: 'TODAY' }
  | { readonly kind: 'NEXT' }
  | { readonly kind: 'CONFIGURE_SCHEDULE' }
  | { readonly kind: 'ADD_EXCEPTION' }
  | { readonly kind: 'NEW_APPOINTMENT' }
  | { readonly kind: 'RETRY_APPOINTMENTS' }
  | { readonly kind: 'RETRY_RULES' }
  | { readonly kind: 'RETRY_EXCEPTIONS' }
  /** « Rouvrir » on a closed (BLOCK) slot: reuses the existing delete-exception flow. */
  | { readonly kind: 'REOPEN_EXCEPTION'; readonly exceptionId: string }
  /** A date chosen in the picker: a Tunis calendar date, `YYYY-MM-DD`. */
  | { readonly kind: 'GO_TO_DATE'; readonly date: string }
  | { readonly kind: 'SET_SEARCH'; readonly query: string }
  | { readonly kind: 'OPEN_ITEM'; readonly resource: 'appointment' | 'request'; readonly id: string }
  | { readonly kind: 'TOGGLE_FILTER'; readonly state: CalendarState }
  | { readonly kind: 'RESET_FILTERS' }
  | { readonly kind: 'TOGGLE_DISCREET' }
  | { readonly kind: 'TOGGLE_SHORTCUTS' }
  // ---- month view (CAL-5) ----
  /** A day of the month grid: switch to the Jour view on that Tunis date. */
  | { readonly kind: 'OPEN_DAY'; readonly date: string }
  /** « + Rendez-vous » of a day preview: quick create on that Tunis date. */
  | { readonly kind: 'NEW_APPOINTMENT_ON'; readonly date: string }
  /** The « ⋯ » menu of a day: handled by the existing exception flows. */
  | { readonly kind: 'DAY_MENU'; readonly date: string; readonly command: CalendarMonthMenuCommand }
  | { readonly kind: 'RETRY_SUMMARY' }
  | { readonly kind: 'SHOW_SHORTCUTS' }
  // ---- day view (CAL-6) ----
  /** « Démarrer » on a row: the same command as the CAL-3 panel. */
  | { readonly kind: 'DAY_START'; readonly id: string }
  /** « Accepter » on a request row: the same facade call as the panel. */
  | { readonly kind: 'DAY_ACCEPT'; readonly id: string }
  /** « Refuser » on a request row: opens the panel on its two-step refusal. */
  | { readonly kind: 'DAY_DECLINE'; readonly id: string }
  /** « + Ajouter » on a free row: the booking drawer on that slot (`start` is Tunis « HH:mm »). */
  | { readonly kind: 'DAY_ADD_SLOT'; readonly date: string; readonly start: string }
  /** « Prolonger la journée » on a closed day: the existing exception form, pre-filled. */
  | { readonly kind: 'DAY_EXTEND'; readonly date: string }
  /** « Voir le dossier » of the next-patient card (practice patients): opens the panel, which links to the record. */
  | { readonly kind: 'DAY_OPEN_PATIENT_FILE'; readonly id: string }
  | { readonly kind: 'RETRY_DAY_SUMMARY' }
  | { readonly kind: 'RETRY_DAY_SLOTS' };

export type CalendarMonthMenuCommand = 'EXTEND' | 'CLOSE' | 'ADD_BREAK';

/** What the page gives the month view: the summary of the grid and the data of the side cards. */
export interface CalendarMonthInput {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  /** The 42 (or fewer) Tunis dates of the grid, Monday first. */
  readonly gridKeys: readonly string[];
  /** `YYYY-MM` of the month being shown (days outside it are dimmed). */
  readonly referenceMonth: string;
  readonly summary: CalendarSummary | null;
  readonly hiddenStates: ReadonlySet<CalendarState>;
  readonly appointments: readonly DoctorScheduledCareItem[];
  readonly requests: readonly DoctorScheduledCareItem[];
}

export type DaySourceStatus = 'loading' | 'ready' | 'error';

/**
 * What the page gives the day view: the three sources of one Tunis day (appointments and requests, the
 * calendar summary, the day slots), each with its own loading and error state, plus what the row actions need.
 */
export interface CalendarDayInput {
  readonly dayKey: string;
  /** « Now », ticking once a minute, as an instant. */
  readonly nowMs: number;
  readonly items: {
    readonly status: DaySourceStatus;
    readonly error: string | null;
    readonly list: readonly DoctorScheduledCareItem[];
  };
  readonly summary: {
    readonly status: DaySourceStatus;
    readonly error: string | null;
    readonly day: CalendarSummaryDay | null;
  };
  readonly slots: {
    readonly status: DaySourceStatus;
    readonly error: string | null;
    readonly list: readonly DaySlot[] | null;
  };
  readonly hiddenStates: ReadonlySet<CalendarState>;
  /** No other consultation is running: « Démarrer » may be offered (same condition as the panel). */
  readonly canStart: boolean;
  /** Appointment being started right now. */
  readonly startingId: string | null;
  /** Request being accepted right now. */
  readonly acceptingId: string | null;
  /** A scheduled-care command is running: the row buttons wait. */
  readonly commandBusy: boolean;
  readonly commandError: string | null;
  readonly blockExceptions: readonly BlockException[];
}

export type CalendarAppointmentTypeKind = 'cabinet' | 'urgent' | 'external';

export interface CalendarAppointmentPresentationMetadata {
  readonly kind: 'appointment';
  readonly appointmentId: string;
  readonly patientLabel: string;
  readonly statusLabel: string;
  readonly status?: 'PROPOSED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  readonly categoryLabel?: string;
  readonly detailLabel?: string;
  readonly statusIcon?: 'clock-circle' | 'check-circle';
  /** Colours from the shared appointment-status mapping. */
  readonly statusColor?: string;
  readonly statusTint?: string;
  readonly statusText?: string;
  readonly muted?: boolean;
  readonly struck?: boolean;
  readonly typeKind?: CalendarAppointmentTypeKind;
  readonly typeLabel?: string;
  readonly typeIcon?: string;
  readonly cabinetLabel?: string;
  readonly timeRangeLabel?: string;
  /** IN_PROGRESS consultation started before today: « Consultation non clôturée ». */
  readonly unclosed?: boolean;
  /** CONFIRMED appointment already over and never started: muted card, chip « Non clôturé » (fix 5). */
  readonly notClosed?: boolean;
  /** CAL-1 calendar-only presentation (see calendar-presentation.ts). */
  readonly calendarState?: CalendarState;
  readonly stateLabel?: string;
  readonly dashed?: boolean;
  /** `oc-cal-state--<state>`, also put on the FullCalendar event element. */
  readonly cssClass?: string;
}

/**
 * A booking request placed on the grid at its requested (or proposed) time. It carries the same
 * card fields as an appointment, but is identified by `requestId` and has no appointment status.
 */
export interface CalendarRequestPresentationMetadata
  extends Omit<CalendarAppointmentPresentationMetadata, 'kind' | 'appointmentId' | 'status'> {
  readonly kind: 'request';
  readonly requestId: string;
  readonly requestStatus: string;
}

/** Fields shared by every card drawn on the grid (appointment or request). */
export type CalendarCardMetadata =
  | CalendarAppointmentPresentationMetadata
  | CalendarRequestPresentationMetadata;

export interface CalendarStatePresentationMetadata {
  readonly kind: 'day-state' | 'exception-annotation';
  readonly title: string;
  readonly description: string;
  readonly icon: 'calendar' | 'clock-circle';
  readonly exceptionId?: string;
  readonly exceptionType?: 'BLOCK' | 'EXTRA';
}

export interface CalendarBreakPresentationMetadata {
  readonly kind: 'break';
  readonly title: string;
  /** « 12:30 – 14:00 » from the weekly rule's pause. */
  readonly timeLabel: string;
}

export type CalendarPresentationMetadata =
  | CalendarAppointmentPresentationMetadata
  | CalendarRequestPresentationMetadata
  | CalendarStatePresentationMetadata
  | CalendarBreakPresentationMetadata;

export interface CalendarPresentationInput {
  readonly options: CalendarOptions;
  readonly events: EventInput[];
}
