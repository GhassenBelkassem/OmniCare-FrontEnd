import type { EventInput } from '@fullcalendar/angular';

import { APPOINTMENT_STATUS, appointmentStatusPresentation } from '../../../shared/ui/appointment-status';

import type {
  AppointmentDto,
  AvailabilityExceptionDto,
  UrgentOfferDto,
} from '../appointment-api.models';
import type { UrgentRequestSummaryDto } from '../doctor-urgent-api.service';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import type { CalendarAppointmentPresentationMetadata } from './calendar-view.models';
import {
  addEstimatedMinutesToInstant,
  exceptionWallClockDateTime,
  formatCalendarTime,
  formatCalendarTimeRange,
  preserveAppointmentInstant,
  toLocalDateOnly,
} from './calendar-time.adapter';

export type ProjectedAppointmentStatus = 'PROPOSED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';

export type ScheduledCalendarStatus = ProjectedAppointmentStatus | 'CANCELLED' | 'NO_SHOW';

export interface AppointmentEventMetadata extends CalendarAppointmentPresentationMetadata {
  readonly status: ScheduledCalendarStatus;
}

export interface AppointmentCalendarEvent extends EventInput {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly allDay: false;
  readonly interactive: true;
  readonly className: string;
  readonly extendedProps: AppointmentEventMetadata;
}

export interface ExceptionEventMetadata {
  readonly kind: 'block-exception' | 'extra-exception' | 'exception-annotation';
  readonly exceptionId: string;
  readonly exceptionType: 'BLOCK' | 'EXTRA';
  readonly typeLabel: string;
  readonly reason: string | null;
  readonly timeLabel: string;
  readonly title: string;
  readonly description: string;
  readonly icon: 'calendar' | 'clock-circle';
}

export interface ExceptionCalendarEvent extends EventInput {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly allDay: false;
  readonly display: 'background' | 'block';
  readonly interactive: boolean;
  readonly className: string;
  readonly extendedProps: ExceptionEventMetadata;
}

export interface UrgentCalendarRecord {
  readonly requestId: string;
  readonly patientLabel: string;
  readonly startInstant: string;
  readonly arrivedAtInstant: string | null;
}

export interface UrgentEventMetadata {
  readonly kind: 'urgent-estimate';
  readonly requestId: string;
  readonly patientLabel: string;
  readonly estimatedMinutes: 30;
  readonly statusLabel: string;
  readonly arrivedAtInstant: string | null;
}

export interface UrgentCalendarEvent extends EventInput {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly allDay: false;
  readonly interactive: false;
  readonly className: string;
  readonly extendedProps: UrgentEventMetadata;
}

export const URGENT_ESTIMATED_MINUTES = 30;
const CLOSED_URGENT_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED']);

// Labels and colours come from the shared mapping; only the CSS hook is local.
const STATUS_PRESENTATION: Readonly<
  Record<ProjectedAppointmentStatus, { readonly label: string; readonly className: string }>
> = {
  PROPOSED: {
    label: APPOINTMENT_STATUS.PROPOSED.label,
    className: 'omnicare-appointment-event--proposed',
  },
  CONFIRMED: {
    label: APPOINTMENT_STATUS.CONFIRMED.label,
    className: 'omnicare-appointment-event--confirmed',
  },
  IN_PROGRESS: {
    label: APPOINTMENT_STATUS.IN_PROGRESS.label,
    className: 'omnicare-appointment-event--in-progress',
  },
  COMPLETED: {
    label: APPOINTMENT_STATUS.COMPLETED.label,
    className: 'omnicare-appointment-event--completed',
  },
};

const APPOINTMENT_TONE_CLASS = {
  omnicarePatient: 'demo-calendar-appointment--omnicare-patient',
  followUp: 'demo-calendar-appointment--follow-up',
  externalPatient: 'demo-calendar-appointment--external-patient',
} as const;

export function appointmentPatientLabel(appointment: AppointmentDto): string {
  const displayName = appointment.patientName?.trim();
  return displayName || appointment.patientId;
}

export function appointmentStatusLabel(status: ProjectedAppointmentStatus): string {
  return STATUS_PRESENTATION[status].label;
}

export function toAppointmentCalendarEvent(
  appointment: AppointmentDto,
): AppointmentCalendarEvent | null {
  if (!isProjectedStatus(appointment.status)) return null;

  const presentation = STATUS_PRESENTATION[appointment.status];
  const patientLabel = appointmentPatientLabel(appointment);
  const toneClass =
    appointment.source === 'PRACTICE_PATIENT'
      ? APPOINTMENT_TONE_CLASS.externalPatient
      : appointment.source === 'DOCTOR_FOLLOWUP'
        ? APPOINTMENT_TONE_CLASS.followUp
        : APPOINTMENT_TONE_CLASS.omnicarePatient;

  return {
    id: `appointment:${appointment.id}`,
    title: patientLabel,
    start: preserveAppointmentInstant(appointment.startTime),
    end: preserveAppointmentInstant(appointment.endTime),
    allDay: false,
    interactive: true,
    className: `${presentation.className} ${toneClass}`,
    extendedProps: {
      kind: 'appointment',
      appointmentId: appointment.id,
      status: appointment.status,
      patientLabel,
      statusLabel: presentation.label,
    },
  };
}

export function projectExceptionEvents(
  exceptions: readonly AvailabilityExceptionDto[],
  view: 'day' | 'week' | 'month',
): ExceptionCalendarEvent[] {
  if (view === 'month') return [];

  return exceptions.flatMap((exception) => {
    const isBlock = exception.type === 'BLOCK';
    const typeLabel = isBlock ? 'Indisponible' : 'Ouverture exceptionnelle';
    const timeLabel = `${exception.startTime}–${exception.endTime}`;
    const shared = {
      exceptionId: exception.id,
      exceptionType: exception.type,
      typeLabel,
      reason: exception.reason,
      timeLabel,
      title: typeLabel,
      description: exception.reason ?? timeLabel,
      icon: isBlock ? 'calendar' : 'clock-circle',
    } as const;
    const start = exceptionWallClockDateTime(exception.exceptionDate, exception.startTime);
    const end = exceptionWallClockDateTime(exception.exceptionDate, exception.endTime);

    return [
      {
        id: `exception:${exception.type.toLowerCase()}:${exception.id}`,
        title: typeLabel,
        start,
        end,
        allDay: false,
        display: 'background',
        interactive: false,
        className: isBlock
          ? 'omnicare-exception-background--block'
          : 'omnicare-exception-background--extra',
        backgroundColor: isBlock
          ? 'var(--oc-color-critical-surface)'
          : 'var(--oc-color-success-surface)',
        extendedProps: {
          ...shared,
          kind: isBlock ? 'block-exception' : 'extra-exception',
        },
      },
      {
        id: `exception-annotation:${exception.id}`,
        title: typeLabel,
        start,
        end,
        allDay: false,
        display: 'block',
        interactive: true,
        className: isBlock
          ? 'omnicare-exception-annotation--block'
          : 'omnicare-exception-annotation--extra',
        extendedProps: { ...shared, kind: 'exception-annotation' },
      },
    ];
  });
}

export function toUrgentCalendarRecord(
  summary: UrgentRequestSummaryDto,
  offer: UrgentOfferDto | undefined,
): UrgentCalendarRecord | null {
  if (CLOSED_URGENT_STATUSES.has(summary.status)) return null;
  if (summary.status !== 'MATCHED' && summary.arrivedAt === null) return null;

  const startInstant = summary.matchedAt ?? summary.arrivedAt;
  if (startInstant === null || Number.isNaN(new Date(startInstant).getTime())) return null;

  return {
    requestId: summary.id,
    patientLabel: offer?.patientName.trim() || 'Patient urgent',
    startInstant,
    arrivedAtInstant: summary.arrivedAt,
  };
}

export function toUrgentCalendarEvent(record: UrgentCalendarRecord): UrgentCalendarEvent | null {
  const end = addEstimatedMinutesToInstant(record.startInstant, URGENT_ESTIMATED_MINUTES);
  if (end === null) return null;

  const arrivedAt = record.arrivedAtInstant ? new Date(record.arrivedAtInstant) : null;
  const statusLabel = arrivedAt
    ? `Patient arrivé à ${formatCalendarTime(arrivedAt)}`
    : 'Arrivée estimée';

  return {
    id: `urgent:${record.requestId}`,
    title: record.patientLabel,
    start: record.startInstant,
    end,
    allDay: false,
    interactive: false,
    className: record.arrivedAtInstant
      ? 'omnicare-urgent-event--arrived'
      : 'omnicare-urgent-event--estimated',
    extendedProps: {
      kind: 'urgent-estimate',
      requestId: record.requestId,
      patientLabel: record.patientLabel,
      estimatedMinutes: URGENT_ESTIMATED_MINUTES,
      statusLabel,
      arrivedAtInstant: record.arrivedAtInstant,
    },
  };
}

export function projectUrgentEvents(
  records: readonly UrgentCalendarRecord[],
): UrgentCalendarEvent[] {
  return records.reduce<UrgentCalendarEvent[]>((events, record) => {
    const event = toUrgentCalendarEvent(record);
    if (event !== null) events.push(event);
    return events;
  }, []);
}

export function projectAppointmentEvents(
  appointments: readonly AppointmentDto[],
): AppointmentCalendarEvent[] {
  return appointments.reduce<AppointmentCalendarEvent[]>((events, appointment) => {
    const event = toAppointmentCalendarEvent(appointment);
    if (event !== null) events.push(event);
    return events;
  }, []);
}

const SCHEDULED_STATUS_CLASS: Readonly<Record<ScheduledCalendarStatus, string>> = {
  PROPOSED: 'omnicare-appointment-event--proposed',
  CONFIRMED: 'omnicare-appointment-event--confirmed',
  IN_PROGRESS: 'omnicare-appointment-event--in-progress',
  COMPLETED: 'omnicare-appointment-event--completed',
  CANCELLED: 'omnicare-appointment-event--cancelled',
  NO_SHOW: 'omnicare-appointment-event--no-show',
};

const TYPE_PRESENTATION = {
  external: { label: 'Patient externe', icon: 'user-add' },
  urgent: { label: 'Urgence', icon: 'warning' },
  cabinet: { label: 'Cabinet', icon: 'home' },
} as const;

/**
 * Calendar projection of a scheduled-care appointment. Labels and colours come from the
 * shared appointment-status mapping. Cancelled and no-show appointments stay visible
 * (muted / struck through) so the doctor sees what happened to the slot.
 */
export function toScheduledAppointmentCalendarEvent(
  item: DoctorScheduledCareItem,
  now: Date = new Date(),
): AppointmentCalendarEvent | null {
  if (
    item.resourceType !== 'APPOINTMENT' ||
    item.appointmentId === null ||
    !isScheduledCalendarStatus(item.status)
  ) {
    return null;
  }
  const presentation = appointmentStatusPresentation(item.status) ?? APPOINTMENT_STATUS.CONFIRMED;
  const patientLabel = item.subject.displayName.trim() || 'Patient';
  const typeKind = item.subject.subjectType === 'PRACTICE_PATIENT' ? 'external' : 'cabinet';
  const type = TYPE_PRESENTATION[typeKind];
  const toneClass =
    typeKind === 'external'
      ? APPOINTMENT_TONE_CLASS.externalPatient
      : APPOINTMENT_TONE_CLASS.omnicarePatient;
  const start = new Date(item.start);
  const unclosed =
    item.status === 'IN_PROGRESS' && toLocalDateOnly(start) < toLocalDateOnly(now);
  return {
    id: `appointment:${item.appointmentId}`,
    title: patientLabel,
    start: preserveAppointmentInstant(item.start),
    end: preserveAppointmentInstant(item.end),
    allDay: false,
    interactive: true,
    className: [
      SCHEDULED_STATUS_CLASS[item.status],
      toneClass,
      presentation.muted ? 'oc-calendar-event--muted' : '',
      presentation.struck ? 'oc-calendar-event--struck' : '',
    ]
      .filter(Boolean)
      .join(' '),
    extendedProps: {
      kind: 'appointment',
      appointmentId: item.appointmentId,
      status: item.status,
      patientLabel,
      statusLabel: presentation.label,
      statusColor: presentation.color,
      statusTint: presentation.tint,
      statusText: presentation.text,
      muted: presentation.muted,
      struck: presentation.struck,
      typeKind,
      typeLabel: type.label,
      typeIcon: type.icon,
      cabinetLabel: item.cabinet.name?.trim() || 'Cabinet non renseigné',
      timeRangeLabel: formatCalendarTimeRange(start, new Date(item.end)),
      unclosed,
    },
  };
}

export function projectScheduledAppointmentEvents(
  items: readonly DoctorScheduledCareItem[],
): AppointmentCalendarEvent[] {
  return items.reduce<AppointmentCalendarEvent[]>((events, item) => {
    const event = toScheduledAppointmentCalendarEvent(item);
    if (event !== null) events.push(event);
    return events;
  }, []);
}

function isScheduledCalendarStatus(status: string): status is ScheduledCalendarStatus {
  return isProjectedStatus(status) || status === 'CANCELLED' || status === 'NO_SHOW';
}

function isProjectedStatus(status: string): status is ProjectedAppointmentStatus {
  return status === 'PROPOSED' || status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}
