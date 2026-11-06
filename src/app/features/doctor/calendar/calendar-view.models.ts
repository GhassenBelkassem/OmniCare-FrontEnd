import type { CalendarOptions, EventInput } from '@fullcalendar/angular';

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
  readonly panelOpen: boolean;
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly rulesError: string | null;
  readonly exceptionsError: string | null;
  readonly mutationError: string | null;
  readonly noSchedule: boolean;
  readonly realtimeDeferred: boolean;
  readonly ariaBusy: boolean;
  readonly daySummary: CalendarDaySummary | null;
  readonly notice: string | null;
}

export type CalendarViewAction =
  | { readonly kind: 'SET_VIEW'; readonly value: CalendarViewMode }
  | { readonly kind: 'PREVIOUS' }
  | { readonly kind: 'TODAY' }
  | { readonly kind: 'NEXT' }
  | { readonly kind: 'CONFIGURE_SCHEDULE' }
  | { readonly kind: 'ADD_EXCEPTION' }
  | { readonly kind: 'RETRY_APPOINTMENTS' }
  | { readonly kind: 'RETRY_RULES' }
  | { readonly kind: 'RETRY_EXCEPTIONS' };

export interface CalendarAppointmentPresentationMetadata {
  readonly kind: 'appointment';
  readonly appointmentId: string;
  readonly patientLabel: string;
  readonly statusLabel: string;
  readonly status?: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
  readonly categoryLabel?: string;
  readonly detailLabel?: string;
  readonly statusIcon?: 'clock-circle' | 'check-circle';
}

export interface CalendarStatePresentationMetadata {
  readonly kind: 'day-state' | 'exception-annotation';
  readonly title: string;
  readonly description: string;
  readonly icon: 'calendar' | 'clock-circle';
}

export interface CalendarBreakPresentationMetadata {
  readonly kind: 'break';
  readonly title: string;
}

export type CalendarPresentationMetadata =
  | CalendarAppointmentPresentationMetadata
  | CalendarStatePresentationMetadata
  | CalendarBreakPresentationMetadata;

export interface CalendarPresentationInput {
  readonly options: CalendarOptions;
  readonly events: EventInput[];
}
