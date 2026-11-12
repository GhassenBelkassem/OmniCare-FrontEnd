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
    'Une des permissions sélectionnées n\'est pas reconnue. Vérifiez la sélection et réessayez.',
  'secretary-request-invalid': 'La demande ne peut pas être traitée. Vérifiez les détails et réessayez.',
  'secretary-clinical-access-forbidden':
    'L\'accès clinique ne peut pas être délégué à une secrétaire.',
  'secretary-permission-required':
    'Cette action nécessite une permission qui n\'a pas été accordée.',
  'secretary-context-unavailable':
    'Votre délégation n\'est pas disponible pour le moment. Demandez au médecin de la restaurer.',
  'secretary-membership-required':
    "Vous ne disposez pas d'une délégation active pour ce médecin.",
  'secretary-membership-suspended':
    "Cette délégation est suspendue. Demandez au médecin de la restaurer.",
  'secretary-membership-ended':
    "Cette délégation est terminée et ne peut plus être utilisée.",
  'secretary-doctor-role-required': "Seul un médecin peut gérer sa délégation.",
  'secretary-not-found': 'Cette délégation n\'existe plus.',
  'secretary-cross-doctor-forbidden': "Cette délégation appartient à un autre médecin.",
  'secretary-email-already-registered':
    'Cette adresse e-mail appartient déjà à une secrétaire déléguée.',
  'secretary-invitation-cooldown':
    'Une invitation a été envoyée récemment. Attendez avant d\'en envoyer une autre.',
  'secretary-transition-invalid': 'Cette modification n\'est pas autorisée depuis l\'état actuel.',
  'secretary-permission-empty': 'Accordez au moins une permission.',
  'secretary-self-invite-forbidden': "Vous ne pouvez pas déléguier votre propre compte.",
};

/**
 * Generic secretary error fallback.
 */
const GENERIC_SECRETARY_ERROR =
  'La demande ne peut pas être effectuée. Veuillez réessayez.';

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

/**
 * Field-scoped copy for the delegated invitation form. Keyed by the field the
 * backend names in `fieldErrors`, never by its raw `defaultMessage`, which is
 * developer-facing text ("Already used.", "Header is required.").
 */
const SECRETARY_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  email: 'Entrez une adresse e-mail valide.',
  permissions: 'Accordez au moins une permission.',
};

/**
 * Field-level copy for the delegated invitation form. Keyed by the field the
 * backend names in `fieldErrors`, never by its raw `defaultMessage`, which is
 * developer-facing text ("Already used.", "Header is required.").
 */
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
  INVITED: 'Invitation envoyée',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  ENDED: 'Terminé',
};

export function membershipStatusLabel(status: SecretaryMembershipStatus): string {
  return MEMBERSHIP_STATUS_LABELS[status];
}

const PERMISSION_LABELS: Readonly<Record<SecretaryPermission, string>> = {
  VIEW_AGENDA: 'Consulter l\'agenda',
  MANAGE_AGENDA: 'Gérer l\'agenda',
  CREATE_APPOINTMENT: 'Créer des rendez-vous',
  RESCHEDULE_APPOINTMENT: 'Reprogrammer des rendez-vous',
  CANCEL_APPOINTMENT: 'Annuler des rendez-vous',
  VIEW_PATIENT_CONTACT: 'Voir les coordonnées des patients',
};

export function permissionLabel(permission: SecretaryPermission): string {
  return PERMISSION_LABELS[permission];
}

export function permissionLabels(permissions: readonly SecretaryPermission[]): string {
  return permissions.length === 0
    ? 'Aucune'
    : permissions.map(permissionLabel).join(', ');
}

/**
 * Tone mapping for permission chips in the team list.
 * Uses the oc-tag tone palette (emerald, teal, aqua, neutral).
 */
export function permissionTone(permission: SecretaryPermission): 'emerald' | 'teal' | 'aqua' | 'neutral' {
  switch (permission) {
    case 'VIEW_AGENDA':
      return 'emerald';
    case 'MANAGE_AGENDA':
      return 'teal';
    case 'CREATE_APPOINTMENT':
      return 'emerald';
    case 'RESCHEDULE_APPOINTMENT':
      return 'aqua';
    case 'CANCEL_APPOINTMENT':
      return 'neutral';
    case 'VIEW_PATIENT_CONTACT':
      return 'teal';
  }
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

/**
 * Format a DateTime in French locale
 * Example: "5 oct. 2026, 16:45"
 */
export function formatDateTimeFr(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

/** Alias for backward compatibility with components using formatDateTime */
export const formatDateTime = formatDateTimeFr;