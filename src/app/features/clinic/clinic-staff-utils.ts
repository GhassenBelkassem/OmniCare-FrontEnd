import { HttpErrorResponse } from '@angular/common/http';

import { OcStatus } from '../../shared/ui';
import {
  ClinicAttachableRole,
  ClinicMembershipStatus,
  ClinicProblemDetail,
  ClinicStaffFailureReason,
  ClinicStaffMember,
  ClinicSuspensionReason,
  CLINIC_ATTACHABLE_ROLES,
  CLINIC_SUSPENSION_REASONS,
  toClinicStaffErrorCode,
} from './clinic-api.models';

/** Product vocabulary for the clinic professional roles. Raw enums are never rendered. */
const STAFF_ROLE_LABELS: Readonly<Record<string, string>> = {
  CLINIC_ADMIN: 'Clinic Administrator',
  CLINIC_ASSISTANT: 'Clinic Assistant',
  CLINIC_MEDECIN: 'Clinic Doctor',
  CLINIC_INFIRMIERE: 'Clinic Nurse',
  CLINIC_KINE: 'Clinic Physiotherapist',
};

const MEMBERSHIP_STATUS_LABELS: Readonly<Record<ClinicMembershipStatus, string>> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  ENDED: 'Ended',
};

const SUSPENSION_REASON_LABELS: Readonly<Record<ClinicSuspensionReason, string>> = {
  ADMINISTRATIVE_HOLD: 'Administrative hold',
  DOCUMENTATION_MISSING: 'Documentation missing',
  LEAVE_OF_ABSENCE: 'Leave of absence',
  CONDUCT_REVIEW: 'Conduct review',
  SECURITY_REVIEW: 'Security review',
  OTHER: 'Other',
};

/**
 * Safe, user-facing copy. Backend detail, instance, requestId, exception text and any
 * account-existence signal beyond the bounded contract stay hidden.
 */
const STAFF_FAILURE_MESSAGES: Readonly<Record<ClinicStaffFailureReason, string>> = {
  CLINIC_STAFF_CAPABILITY_REQUIRED: 'You do not have permission to manage clinic staff.',
  CLINIC_STAFF_TARGET_FORBIDDEN: 'This staff membership cannot be managed here.',
  CLINIC_STAFF_NOT_FOUND: 'This staff membership is no longer available.',
  CLINIC_STAFF_REQUEST_INVALID: 'Check the details entered and try again.',
  CLINIC_PROFESSIONAL_NOT_ELIGIBLE: 'This professional cannot be added to the clinic.',
  CLINIC_PROFESSIONAL_ROLE_MISMATCH:
    'The selected professional role does not match this professional.',
  CLINIC_MEMBERSHIP_ALREADY_EXISTS: 'This professional already has a membership in this clinic.',
  CLINIC_MEMBERSHIP_VERSION_CONFLICT:
    'This staff membership changed elsewhere. The latest information has been reloaded.',
  CLINIC_MEMBERSHIP_TRANSITION_INVALID: 'This staff membership change is not allowed.',
  CLINIC_STAFF_REQUEST_FAILED: 'We could not complete this staff action. Please try again.',
};

export interface ClinicStaffRoleOption {
  readonly value: ClinicAttachableRole;
  readonly label: string;
}

export interface ClinicSuspensionReasonOption {
  readonly value: ClinicSuspensionReason;
  readonly label: string;
}

/** CLINIC_ADMIN is intentionally absent: it is never attachable from this UI. */
export const CLINIC_ATTACHABLE_ROLE_OPTIONS: readonly ClinicStaffRoleOption[] =
  CLINIC_ATTACHABLE_ROLES.map((value) => ({ value, label: STAFF_ROLE_LABELS[value] ?? value }));

export const CLINIC_SUSPENSION_REASON_OPTIONS: readonly ClinicSuspensionReasonOption[] =
  CLINIC_SUSPENSION_REASONS.map((value) => ({
    value,
    label: SUSPENSION_REASON_LABELS[value],
  }));

/** Unknown backend values degrade to a readable label instead of crashing the page. */
export function clinicStaffRoleLabel(role: string): string {
  const known = STAFF_ROLE_LABELS[role];
  if (known !== undefined) return known;
  return humanizeEnum(role.replace(/^CLINIC_/, '')) || 'Clinic member';
}

export function clinicMembershipStatusLabel(status: string): string {
  const known = MEMBERSHIP_STATUS_LABELS[status as ClinicMembershipStatus];
  if (known !== undefined) return known;
  return humanizeEnum(status) || 'Unknown';
}

/** Status is conveyed by badge tone and by text, never by colour alone. */
export function clinicMembershipStatusTone(status: string): OcStatus {
  if (status === 'ACTIVE') return 'confirmed';
  if (status === 'INVITED') return 'pending';
  if (status === 'SUSPENDED') return 'blocked';
  if (status === 'ENDED') return 'cancelled';
  return 'draft';
}

export function clinicStaffFailureMessage(reason: ClinicStaffFailureReason): string {
  return STAFF_FAILURE_MESSAGES[reason];
}

/** Maps a transport failure to the bounded local vocabulary. 401 is left to global auth. */
export function readClinicStaffFailureReason(error: unknown): ClinicStaffFailureReason {
  if (!(error instanceof HttpErrorResponse)) return 'CLINIC_STAFF_REQUEST_FAILED';
  const body = error.error as ClinicProblemDetail | null;
  const code = toClinicStaffErrorCode(body?.errorCode);
  if (code !== null) return code;
  if (error.status === 403) return 'CLINIC_STAFF_CAPABILITY_REQUIRED';
  if (error.status === 404) return 'CLINIC_STAFF_NOT_FOUND';
  if (error.status === 400 || error.status === 422) return 'CLINIC_STAFF_REQUEST_INVALID';
  return 'CLINIC_STAFF_REQUEST_FAILED';
}

export function isClinicStaffVersionConflict(reason: ClinicStaffFailureReason): boolean {
  return reason === 'CLINIC_MEMBERSHIP_VERSION_CONFLICT';
}

/** Display identity falls back to a neutral placeholder rather than leaking an ID. */
export function clinicStaffDisplayName(member: ClinicStaffMember): string {
  const value = member.displayName?.trim() ?? '';
  return value.length > 0 ? value : 'Unnamed professional';
}

export function canSuspendMembership(status: ClinicMembershipStatus): boolean {
  return status === 'ACTIVE';
}

export function canReactivateMembership(status: ClinicMembershipStatus): boolean {
  return status === 'SUSPENDED';
}

/** ENDED is terminal, and an unexpected INVITED row never gains an invented transition. */
export function canEndMembership(status: ClinicMembershipStatus): boolean {
  return status === 'ACTIVE' || status === 'SUSPENDED';
}

function humanizeEnum(value: string): string {
  const words = value
    .toLocaleLowerCase()
    .split('_')
    .filter((part) => part.length > 0)
    .join(' ');
  return words.length === 0 ? '' : words.charAt(0).toLocaleUpperCase() + words.slice(1);
}
