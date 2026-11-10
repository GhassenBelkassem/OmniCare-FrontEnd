import { DashboardRole } from '../../core/auth/auth.models';
import { normalizeHttpError } from '../../core/http/app-http-error';
import { AccountStatus, ManagedProfessionalRole } from './admin-api.models';
import { OcStatus } from '../../shared/ui';

const PROFESSIONAL_ROLE_LABELS: Readonly<Record<ManagedProfessionalRole, string>> = {
  DOCTOR: 'Independent doctor',
  CLINIC_ADMIN: 'Clinic administrator',
  CLINIC_ASSISTANT: 'Clinic assistant',
  CLINIC_MEDECIN: 'Clinic doctor',
  CLINIC_INFIRMIERE: 'Clinic nurse',
  CLINIC_KINE: 'Clinic physiotherapist',
};

export function apiMessage(error: unknown): string {
  return normalizeHttpError(error).message;
}

export function statusTone(status: AccountStatus | 'ENDED'): OcStatus {
  if (status === 'ACTIVE') return 'confirmed';
  if (status === 'INVITED') return 'pending';
  if (status === 'SUSPENDED') return 'blocked';
  return 'cancelled';
}

export function professionalRoleLabel(role: string): string {
  const known = PROFESSIONAL_ROLE_LABELS[role as ManagedProfessionalRole];
  if (known !== undefined) return known;
  return role
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Professional';
}

export function professionalRoleDescription(role: string): string {
  return `${professionalRoleLabel(role)} account`;
}

const ROLE_LABELS: Record<DashboardRole, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  SECRETARY: 'Secretary',
  NURSE: 'Nurse',
  KINE: 'Physiotherapist',
  CLINIC_MEDECIN: 'Clinic physician',
  CLINIC_INFIRMIERE: 'Clinic nurse',
  CLINIC_KINE: 'Clinic physiotherapist',
  CLINIC_ASSISTANT: 'Clinic assistant',
  CLINIC_ADMIN: 'Clinic administrator',
  ADMIN: 'Platform administrator',
};

export function roleLabel(role: DashboardRole): string {
  return ROLE_LABELS[role];
}

const CLINIC_FIELD_LABELS: Readonly<Record<string, string>> = {
  name: 'Clinic name',
  contactEmail: 'Contact email',
  contactPhone: 'Contact phone',
  governorate: 'Governorate',
  address: 'Address',
  inpdpNumber: 'INPDP number',
};

export function createClinicErrorMessage(error: unknown): string {
  const failure = normalizeHttpError(error);
  if (failure.code === 'DUPLICATE_CLINIC_INPDP') {
    return 'This INPDP number is already registered to another clinic. Check the number for a typo.';
  }
  if (failure.code === 'IDEMPOTENCY_KEY_REUSED') {
    return 'This submission was already used for a different clinic. Close the form and start again.';
  }
  if (failure.code === 'VALIDATION_ERROR') {
    const entries = Object.entries(failure.fieldErrors);
    if (entries.length > 0) {
      return entries
        .map(([field, message]) => `${CLINIC_FIELD_LABELS[field] ?? field}: ${message}`)
        .join(' · ');
    }
  }
  return apiMessage(error);
}
