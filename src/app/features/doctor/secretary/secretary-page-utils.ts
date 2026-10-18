import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorBody } from '../../../core/auth/auth.models';
import { OcStatus } from '../../../shared/ui';
import { SecretaryMembershipStatus, SecretaryPermission } from './secretary-api.models';

/**
 * Human copy for the contract's error codes.
 *
 * Codes the backend reserves but cannot currently emit
 * (`secretary-already-delegated`, `secretary-version-conflict`) are
 * deliberately absent: they fall through to the generic branch rather than
 * growing UI for a case that cannot be provoked.
 */
const SECRETARY_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'secretary-permission-unknown':
    'One of the selected permissions is not recognised. Review the selection and try again.',
  'secretary-request-invalid': 'The request could not be processed. Check the details and try again.',
  'secretary-clinical-access-forbidden':
    'Clinical access cannot be delegated to a secretary.',
  'secretary-permission-required':
    'This action requires a permission that has not been granted.',
  'secretary-context-unavailable':
    'Your delegation is not available right now. Ask the doctor to restore it.',
  'secretary-membership-required':
    'You do not have an active delegation for this doctor.',
  'secretary-membership-suspended':
    'This delegation is suspended. Ask the doctor to restore it.',
  'secretary-membership-ended':
    'This delegation has ended and can no longer be used.',
  'secretary-doctor-role-required': 'Only a doctor can manage their delegation.',
  'secretary-not-found': 'That delegation no longer exists.',
  'secretary-cross-doctor-forbidden': 'That delegation belongs to another doctor.',
  'secretary-email-already-registered':
    'This email already belongs to a delegated secretary.',
  'secretary-invitation-cooldown':
    'An invitation was sent recently. Wait before sending another one.',
  'secretary-transition-invalid': 'That change is not allowed from the current status.',
  'secretary-permission-empty': 'Grant at least one permission.',
  'secretary-self-invite-forbidden': 'You cannot delegate your own account.',
};

const GENERIC_SECRETARY_ERROR =
  'The request could not be completed. Please try again.';

/**
 * Field-scoped copy for the delegated invitation form. Keyed by the field the
 * backend names in `fieldErrors`, never by its raw `defaultMessage`, which is
 * developer-facing text ("Already used.", "Header is required.").
 */
const SECRETARY_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  email: 'Enter a valid email address.',
  permissions: 'Grant at least one permission.',
};

/**
 * Maps a failed delegation request onto the contract's error code.
 *
 * An unmapped code deliberately falls back to the generic copy rather than the
 * backend's `message`: the secretary pages also call endpoints outside the
 * delegation contract (the shared appointment endpoints), so an unmapped code
 * there would otherwise surface raw server text such as "bad range". Codes the
 * backend reserves but cannot emit are therefore indistinguishable from codes we
 * have not written copy for, which is the intended, non-revealing outcome.
 */
export function secretaryErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    const mapped = body?.code ? SECRETARY_ERROR_MESSAGES[body.code] : undefined;
    return mapped ?? GENERIC_SECRETARY_ERROR;
  }
  return error instanceof Error ? error.message : GENERIC_SECRETARY_ERROR;
}

/** Field-level validation copy keyed by the backend's `fieldErrors`. */
export function secretaryFieldError(error: unknown, field: string): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = error.error as ApiErrorBody | null;
  if (!body?.fieldErrors?.[field]) return null;
  return SECRETARY_FIELD_MESSAGES[field] ?? GENERIC_SECRETARY_ERROR;
}

export function membershipStatusTone(status: SecretaryMembershipStatus): OcStatus {
  switch (status) {
    case 'ACTIVE':
      return 'confirmed';
    case 'INVITED':
      return 'pending';
    case 'SUSPENDED':
      return 'blocked';
    default:
      return 'cancelled';
  }
}

const MEMBERSHIP_STATUS_LABELS: Readonly<Record<SecretaryMembershipStatus, string>> = {
  INVITED: 'Invitation sent',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  ENDED: 'Ended',
};

export function membershipStatusLabel(status: SecretaryMembershipStatus): string {
  return MEMBERSHIP_STATUS_LABELS[status];
}

const PERMISSION_LABELS: Readonly<Record<SecretaryPermission, string>> = {
  VIEW_AGENDA: 'View agenda',
  MANAGE_AGENDA: 'Manage agenda',
  CREATE_APPOINTMENT: 'Create appointments',
  RESCHEDULE_APPOINTMENT: 'Reschedule appointments',
  CANCEL_APPOINTMENT: 'Cancel appointments',
  VIEW_PATIENT_CONTACT: 'View patient contact details',
};

export function permissionLabel(permission: SecretaryPermission): string {
  return PERMISSION_LABELS[permission];
}

export function permissionLabels(permissions: readonly SecretaryPermission[]): string {
  return permissions.length === 0
    ? 'None'
    : permissions.map(permissionLabel).join(', ');
}

/**
 * Only an open invitation can be resent. The backend answers anything else with
 * `secretary-transition-invalid`, so the affordance is hidden rather than
 * offered and then refused.
 */
export function canResendInvitation(status: SecretaryMembershipStatus): boolean {
  return status === 'INVITED';
}

/** Suspension is only meaningful for a membership that is currently active. */
export function canSuspend(status: SecretaryMembershipStatus): boolean {
  return status === 'ACTIVE';
}

/** Ending is offered for anything not already ended. */
export function canEnd(status: SecretaryMembershipStatus): boolean {
  return status === 'INVITED' || status === 'ACTIVE' || status === 'SUSPENDED';
}

/** `ENDED` is terminal, so nothing is actionable. */
export function isMutable(status: SecretaryMembershipStatus): boolean {
  return status !== 'ENDED';
}

/**
 * Whether the permission set can be edited from the detail view.
 *
 * `ENDED` is terminal, so it is excluded. The backend currently accepts `INVITED` and
 * `SUSPENDED` too — only `ENDED` is refused — so the affordance is offered for those states
 * rather than hidden and then contradicted by a rejection the user did not expect.
 */
export function canEditPermissions(status: SecretaryMembershipStatus): boolean {
  return isMutable(status);
}