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
  | { readonly kind: 'RETRY_EXCEPTIONS' };

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
