import { HttpErrorResponse } from '@angular/common/http';

import { patientAgeLabel } from '../../../shared/ui/patient-age';

import type {
  PatientChartAccessDto,
  PatientChartDocumentType,
  PatientChartHistoryKind,
  PatientChartIdentityDto,
} from './patient-chart-api.models';

const ZONE = 'Africa/Tunis';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('fr-FR', { timeZone: ZONE, ...options }).format(date) : '';
}

/** « 12/03/1990 » */
export function chartShortDate(value: string | null | undefined): string {
  return format(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** « 12 mars 2026 » */
export function chartLongDate(value: string | null | undefined): string {
  return format(value, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « mardi 10 novembre 2026 » (history day headings) */
export function chartDayHeading(value: string | null | undefined): string {
  const text = format(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** « 14:30 » */
export function chartTime(value: string | null | undefined): string {
  return format(value, { hour: '2-digit', minute: '2-digit' });
}

/** « 12 mars 2026 à 14:30 » */
export function chartDateTime(value: string | null | undefined): string {
  const day = chartLongDate(value);
  const time = chartTime(value);
  return day && time ? `${day} à ${time}` : day;
}

/** Day key in Tunis time, used to group history events. */
export function chartDayKey(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function sexLabel(sex: PatientChartIdentityDto['sex']): string {
  switch (sex) {
    case 'F':
      return 'Femme';
    case 'M':
      return 'Homme';
    case 'OTHER':
      return 'Autre';
    default:
      return 'Non renseigné';
  }
}

export function ageLabel(
  identity: Pick<PatientChartIdentityDto, 'ageYears' | 'ageApproximate' | 'dateOfBirth'>,
  at: Date = new Date(),
): string | null {
  if (!identity.ageApproximate && identity.dateOfBirth) {
    return patientAgeLabel(identity.dateOfBirth, at);
  }
  if (identity.ageYears === null) return null;
  const years = `${identity.ageYears} an${identity.ageYears > 1 ? 's' : ''}`;
  return identity.ageApproximate ? `environ ${years}` : years;
}

export function patientInitials(identity: Pick<PatientChartIdentityDto, 'firstName' | 'lastName'>): string {
  const first = identity.firstName.trim().charAt(0);
  const last = identity.lastName.trim().charAt(0);
  return `${first}${last}`.toLocaleUpperCase('fr-FR') || 'P';
}

export function consultationStatusLabel(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Terminée';
    case 'IN_PROGRESS':
      return 'En cours';
    case 'FINALIZING':
      return 'En cours de clôture';
    case 'ABORTED':
      return 'Interrompue';
    default:
      return 'Statut inconnu';
  }
}

export const DOCUMENT_TYPE_OPTIONS: readonly {
  readonly value: PatientChartDocumentType;
  readonly label: string;
}[] = [
  { value: 'LAB_RESULT', label: 'Analyse biologique' },
  { value: 'IMAGING', label: 'Imagerie' },
  { value: 'PRESCRIPTION_DOCUMENT', label: 'Ordonnance externe' },
  { value: 'REFERRAL', label: 'Courrier / adressage' },
  { value: 'DISCHARGE_SUMMARY', label: 'Compte rendu d’hospitalisation' },
  { value: 'VACCINATION', label: 'Vaccination' },
  { value: 'OTHER_MEDICAL_DOCUMENT', label: 'Autre document médical' },
];

export function documentTypeLabel(type: string | null): string {
  return DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Document médical';
}

export function documentStatusLabel(status: string): string | null {
  switch (status) {
    case 'AVAILABLE':
      return null;
    case 'UPLOAD_INITIATED':
    case 'SCAN_PENDING':
      return 'Analyse de sécurité en cours';
    case 'SCAN_FAILED':
      return 'Fichier refusé';
    default:
      return 'Indisponible';
  }
}

export interface HistoryKindPresentation {
  readonly icon: string;
  readonly text: string;
  readonly tone: 'neutral' | 'primary' | 'error' | 'violet';
}

export const HISTORY_KIND: Readonly<Record<PatientChartHistoryKind, HistoryKindPresentation>> = {
  PATIENT_CREATED: { icon: 'user-add', text: 'Fiche patient créée', tone: 'neutral' },
  APPOINTMENT_BOOKED: { icon: 'calendar', text: 'Rendez-vous planifié', tone: 'neutral' },
  APPOINTMENT_CONFIRMED: { icon: 'check-circle', text: 'Rendez-vous confirmé', tone: 'primary' },
  APPOINTMENT_CANCELLED: { icon: 'close', text: 'Rendez-vous annulé', tone: 'error' },
  APPOINTMENT_COMPLETED: { icon: 'check-circle', text: 'Rendez-vous terminé', tone: 'neutral' },
  APPOINTMENT_NO_SHOW: { icon: 'warning', text: 'Patient absent au rendez-vous', tone: 'error' },
  CONSULTATION_COMPLETED: { icon: 'medicine-box', text: 'Consultation terminée', tone: 'violet' },
  DOCUMENT_ADDED: { icon: 'file-text', text: 'Document ajouté', tone: 'primary' },
  PRESCRIPTION_ISSUED: { icon: 'solution', text: 'Ordonnance émise', tone: 'violet' },
};

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/**
 * Clinical endpoints are called only when the server granted clinical access: the mode must be
 * EXTERNAL_OWNER or OMNICARE_GRANTED (and the actor flag must agree).
 */
export function mayLoadClinical(access: Pick<PatientChartAccessDto, 'mode' | 'clinical'>): boolean {
  return (access.mode === 'EXTERNAL_OWNER' || access.mode === 'OMNICARE_GRANTED') && access.clinical;
}

/** The server answered « clinical access required »: render « Accès requis », not an error. */
export function isAccessRequiredError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return false;
  const code = (error.error as { code?: unknown } | null)?.code;
  return code === 'PATIENT_CHART_CLINICAL_ACCESS_REQUIRED' || code === undefined;
}
