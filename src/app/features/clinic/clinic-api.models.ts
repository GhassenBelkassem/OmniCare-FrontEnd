export const CLINIC_ACCESS_FAMILIES = ['ADMIN', 'DOCTOR', 'CLINIC'] as const;

export type ClinicAccessFamily = (typeof CLINIC_ACCESS_FAMILIES)[number];

export type ClinicMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'ENDED';

export type ClinicLifecycleStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface MeAccessResponse {
  readonly contractVersion: string;
  readonly accessFamily: string;
  readonly resolvedAt: string;
}

export interface ClinicMembershipSummary {
  readonly clinicId: string;
  readonly clinicName: string;
  readonly membershipId: string;
  readonly professionalRole: string;
  readonly membershipStatus: ClinicMembershipStatus;
  readonly clinicStatus: ClinicLifecycleStatus;
  readonly version: number;
}

export interface UnavailableClinicMembership extends ClinicMembershipSummary {
  readonly unavailabilityCode: string;
}

export interface MeClinicsResponse {
  readonly contractVersion: string;
  readonly activeMemberships: readonly ClinicMembershipSummary[];
  readonly unavailableMemberships: readonly UnavailableClinicMembership[];
  readonly resolvedAt: string;
}

export const CLINIC_FEATURE_FLAG_KEYS = [
  'CLINIC_REQUESTS_ENABLED',
  'CLINIC_HOSPITALIZATION_ENABLED',
  'CLINIC_SURGERY_ENABLED',
  'CLINIC_URGENT_ENABLED',
  'CLINIC_MOBILE_TASKS_ENABLED',
  'CLINIC_PARTNERSHIP_ENABLED',
] as const;

export type ClinicFeatureFlagKey = (typeof CLINIC_FEATURE_FLAG_KEYS)[number];

export type ClinicFeatureFlags = Readonly<Partial<Record<ClinicFeatureFlagKey, boolean>>>;

export interface ClinicBootstrapClinic {
  readonly clinicId: string;
  readonly clinicName: string;
  readonly clinicStatus: ClinicLifecycleStatus;
}

export interface ClinicBootstrapMembership {
  readonly membershipId: string;
  readonly membershipStatus: ClinicMembershipStatus;
  readonly professionalRole: string;
  readonly version: number;
}

export interface ClinicBootstrapResponse {
  readonly contractVersion: string;
  readonly clinic: ClinicBootstrapClinic;
  readonly membership: ClinicBootstrapMembership;
  readonly capabilities: readonly string[];
  readonly featureFlags: ClinicFeatureFlags;
  readonly resolvedAt: string;
}

/** RFC 9457 payload returned by the clinic error contract. Never rendered verbatim. */
export interface ClinicProblemDetail {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly timestamp?: string;
}

export const CLINIC_ACCESS_ERROR_CODES = [
  'CLINIC_CONTEXT_UNAVAILABLE',
  'CLINIC_SCOPE_FORBIDDEN',
  'CLINIC_MEMBERSHIP_SUSPENDED',
  'CLINIC_MEMBERSHIP_ENDED',
  'CLINIC_MEMBERSHIP_REQUIRED',
  'CLINIC_NOT_ACTIVE',
  'CLINIC_PROFESSIONAL_ROLE_INVALID',
  'CLINIC_CAPABILITY_FORBIDDEN',
] as const;

export type ClinicAccessErrorCode = (typeof CLINIC_ACCESS_ERROR_CODES)[number];

/** Local-only reasons that never come from the backend contract. */
export type ClinicAccessReason =
  | ClinicAccessErrorCode
  | 'CLINIC_NO_ACTIVE_MEMBERSHIP'
  | 'CLINIC_ACCESS_FAMILY_UNSUPPORTED'
  | 'CLINIC_REQUEST_FAILED';

export interface ClinicAccessError {
  readonly reason: ClinicAccessReason;
  readonly message: string;
}

export function toClinicAccessFamily(value: string): ClinicAccessFamily | null {
  return (CLINIC_ACCESS_FAMILIES as readonly string[]).includes(value)
    ? (value as ClinicAccessFamily)
    : null;
}

export function toClinicAccessErrorCode(value: unknown): ClinicAccessErrorCode | null {
  return typeof value === 'string' && (CLINIC_ACCESS_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ClinicAccessErrorCode)
    : null;
}
