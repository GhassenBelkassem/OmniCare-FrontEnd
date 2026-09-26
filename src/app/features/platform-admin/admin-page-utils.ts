import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorBody } from '../../core/auth/auth.models';
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
  if (error instanceof HttpErrorResponse) {
    return (error.error as ApiErrorBody | null)?.message ?? 'The request could not be completed.';
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
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
