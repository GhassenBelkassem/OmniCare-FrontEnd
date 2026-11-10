/**
 * The single appointment-status presentation mapping for the doctor workspace.
 * Calendar, home, lists and drawers must use this; do not map statuses locally.
 */
export type AppointmentStatusKey =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentStatusTone =
  | 'amber'
  | 'primary'
  | 'violet'
  | 'neutral'
  | 'error'
  | 'error-dark';

export interface AppointmentStatusPresentation {
  readonly key: AppointmentStatusKey;
  readonly label: string;
  readonly tone: AppointmentStatusTone;
  /** Accent (dot, border, left rule) colour token. */
  readonly color: string;
  /** Light tint for card/tag backgrounds. */
  readonly tint: string;
  /** AA text colour on the tint. */
  readonly text: string;
  /** Rendered muted (e.g. calendar card) */
  readonly muted: boolean;
  /** Patient name struck through (calendar). */
  readonly struck: boolean;
}

export const APPOINTMENT_STATUS: Readonly<Record<AppointmentStatusKey, AppointmentStatusPresentation>> = {
  PENDING: {
    key: 'PENDING',
    label: 'En attente',
    tone: 'amber',
    color: 'var(--oc-amber)',
    tint: 'var(--oc-amber-tint)',
    text: 'var(--oc-amber-dark)',
    muted: false,
    struck: false,
  },
  CONFIRMED: {
    key: 'CONFIRMED',
    label: 'Confirmé',
    tone: 'primary',
    color: 'var(--oc-primary)',
    tint: 'var(--oc-primary-tint)',
    text: 'var(--oc-primary-dark)',
    muted: false,
    struck: false,
  },
  IN_PROGRESS: {
    key: 'IN_PROGRESS',
    label: 'En cours',
    tone: 'violet',
    color: 'var(--oc-violet)',
    tint: 'var(--oc-violet-tint)',
    text: 'var(--oc-violet-dark)',
    muted: false,
    struck: false,
  },
  COMPLETED: {
    key: 'COMPLETED',
    label: 'Terminé',
    tone: 'neutral',
    color: 'var(--oc-grey-400)',
    tint: 'var(--oc-grey-tint)',
    text: 'var(--oc-grey-600)',
    muted: true,
    struck: false,
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Annulé',
    tone: 'error',
    color: 'var(--oc-error)',
    tint: 'var(--oc-error-tint)',
    text: 'var(--oc-error-dark)',
    muted: true,
    struck: true,
  },
  NO_SHOW: {
    key: 'NO_SHOW',
    label: 'Absent',
    tone: 'error-dark',
    color: 'var(--oc-error-dark)',
    tint: 'var(--oc-error-tint)',
    text: 'var(--oc-error-dark)',
    muted: false,
    struck: false,
  },
};

const BOOKING_REQUEST_PENDING = new Set([
  'PENDING',
  'PENDING_DOCTOR',
  'PENDING_PATIENT_TIME_CONFIRMATION',
]);

/** Normalises any appointment or pending booking-request status to the shared key. */
export function appointmentStatusKey(status: string | null | undefined): AppointmentStatusKey | null {
  if (!status) return null;
  if (BOOKING_REQUEST_PENDING.has(status)) return 'PENDING';
  return status in APPOINTMENT_STATUS ? (status as AppointmentStatusKey) : null;
}

export function appointmentStatusPresentation(
  status: string | null | undefined,
): AppointmentStatusPresentation | null {
  const key = appointmentStatusKey(status);
  return key === null ? null : APPOINTMENT_STATUS[key];
}

/** French label; falls back to « Statut inconnu » (never the raw backend code). */
export function appointmentStatusLabel(status: string | null | undefined): string {
  return appointmentStatusPresentation(status)?.label ?? 'Statut inconnu';
}
