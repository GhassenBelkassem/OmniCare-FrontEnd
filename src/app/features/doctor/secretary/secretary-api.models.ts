/**
 * Wire types for the Step 3 doctor-staff delegation contract.
 * Source of truth: docs/step3-secretary-contract.md
 *
 * The list is still identified by email only. Names are optional, captured at
 * invite time and surfaced on the detail view alone, so `DoctorStaffSummary` has
 * no name fields; `DoctorStaffDetail` is the one place they appear.
 */
export const SECRETARY_PERMISSIONS = [
  'VIEW_AGENDA',
  'MANAGE_AGENDA',
  'CREATE_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'CANCEL_APPOINTMENT',
  'VIEW_PATIENT_CONTACT',
] as const;

export type SecretaryPermission = (typeof SECRETARY_PERMISSIONS)[number];

export const SECRETARY_MEMBERSHIP_STATUSES = [
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'ENDED',
] as const;

export type SecretaryMembershipStatus = (typeof SECRETARY_MEMBERSHIP_STATUSES)[number];

export interface DoctorStaffSummary {
  readonly membershipId: string;
  readonly secretaryUserId: string | null;
  readonly email: string;
  readonly status: SecretaryMembershipStatus;
  readonly permissions: readonly SecretaryPermission[];
  readonly invitedAt: string;
  readonly activatedAt: string | null;
  readonly suspendedAt: string | null;
  readonly endedAt: string | null;
  readonly version: number;
  /** Non-null only while an invitation is open. */
  readonly invitationExpiresAt: string | null;
}

/**
 * Names are optional so a doctor can delegate immediately without having the name
 * to hand. Sending either one (or neither) is valid; the backend stores a profile
 * only when at least one is present.
 */
export interface SecretaryInvitationRequest {
  readonly email: string;
  /** Omitted entirely means "grant the default agenda set". */
  readonly permissions?: readonly SecretaryPermission[];
  readonly firstName?: string;
  readonly lastName?: string;
}

export interface SecretaryInvitationResponse {
  readonly membershipId: string;
  readonly secretaryUserId: string | null;
  readonly email: string;
  readonly status: SecretaryMembershipStatus;
  readonly permissions: readonly SecretaryPermission[];
  readonly invitationExpiresAt: string | null;
}

export interface SecretaryResendInvitationResponse {
  readonly membershipId: string;
  readonly invitationExpiresAt: string | null;
}

/** Summary plus the optional captured name. Names are absent for older delegations. */
export interface DoctorStaffDetail extends DoctorStaffSummary {
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface SecretaryPermissionsRequest {
  /** Full desired set: the endpoint replaces rather than merges. */
  readonly permissions: readonly SecretaryPermission[];
}