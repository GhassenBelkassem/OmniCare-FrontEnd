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
  readonly capabilities: readonly ClinicCapability[];
  readonly featureFlags: ClinicFeatureFlags;
  readonly resolvedAt: string;
}

/** Exact capability vocabulary currently exposed by the Clinic bootstrap contract. */
export const CLINIC_CAPABILITIES = [
  'CLINIC_OVERVIEW_READ',
  'CLINIC_PROFILE_READ',
  'CLINIC_MEMBERSHIP_SELF_READ',
  'CLINIC_CASE_INTAKE_READ',
  'CLINIC_CASE_INTAKE_REVIEW',
  'CLINIC_TASK_READ',
  'CLINIC_TASK_HANDOVER',
  'CLINIC_TASK_REASSIGN',
  'CLINIC_ROUTING_INCIDENT_READ',
  'CLINIC_ROUTING_INCIDENT_RETRY',
  'CLINIC_STAFF_READ',
  'CLINIC_STAFF_INVITE',
  'CLINIC_STAFF_SUSPEND',
  'CLINIC_STAFF_REACTIVATE',
  'CLINIC_STAFF_END',
  'CLINIC_POSITION_READ',
  'CLINIC_POSITION_MANAGE',
  'CLINIC_POSITION_ASSIGNMENT_READ',
  'CLINIC_POSITION_ASSIGNMENT_MANAGE',
  'CLINIC_RESPONSIBILITY_READ',
  'CLINIC_RESPONSIBILITY_MANAGE',
] as const;

export type ClinicCapability = (typeof CLINIC_CAPABILITIES)[number];

export const CLINIC_REQUESTS_READ_CAPABILITY: ClinicCapability = 'CLINIC_CASE_INTAKE_READ';

export function hasClinicCapability(
  bootstrap: ClinicBootstrapResponse | null,
  capability: ClinicCapability,
): boolean {
  return bootstrap?.capabilities.includes(capability) ?? false;
}

/** Clinic-owned professional identity. Mirrors the backend ClinicProfessionalRole enum. */
export const CLINIC_PROFESSIONAL_ROLES = [
  'CLINIC_ADMIN',
  'CLINIC_ASSISTANT',
  'CLINIC_MEDECIN',
  'CLINIC_INFIRMIERE',
  'CLINIC_KINE',
] as const;

export type ClinicProfessionalRole = (typeof CLINIC_PROFESSIONAL_ROLES)[number];

/**
 * Roles a clinic administrator may attach from the Staff UI. CLINIC_ADMIN is deliberately
 * excluded: administrator memberships are never created from this surface.
 */
export const CLINIC_ATTACHABLE_ROLES = [
  'CLINIC_ASSISTANT',
  'CLINIC_MEDECIN',
  'CLINIC_INFIRMIERE',
  'CLINIC_KINE',
] as const satisfies readonly ClinicProfessionalRole[];

export type ClinicAttachableRole = (typeof CLINIC_ATTACHABLE_ROLES)[number];

/** Bounded, server-owned suspension vocabulary. Mirrors ClinicMembershipSuspensionReason. */
export const CLINIC_SUSPENSION_REASONS = [
  'ADMINISTRATIVE_HOLD',
  'DOCUMENTATION_MISSING',
  'LEAVE_OF_ABSENCE',
  'CONDUCT_REVIEW',
  'SECURITY_REVIEW',
  'OTHER',
] as const;

export type ClinicSuspensionReason = (typeof CLINIC_SUSPENSION_REASONS)[number];

/** Backend bounds, applied client-side so an obviously invalid request is never sent. */
export const CLINIC_STAFF_EMAIL_MAX_LENGTH = 255;
export const CLINIC_STAFF_NOTE_MAX_LENGTH = 500;
export const CLINIC_STAFF_SEARCH_MAX_LENGTH = 120;
export const CLINIC_STAFF_DEFAULT_PAGE_SIZE = 20;

export interface ClinicStaffMember {
  readonly membershipId: string;
  readonly displayName: string | null;
  readonly professionalRole: string;
  readonly membershipStatus: ClinicMembershipStatus;
  readonly joinedAt: string | null;
  readonly suspendedAt: string | null;
  readonly endedAt: string | null;
  readonly version: number;
}

/** Slice-style page: {@code hasNext} only, never a fabricated total count. */
export interface ClinicStaffPage {
  readonly contractVersion: string;
  readonly items: readonly ClinicStaffMember[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicStaffQuery {
  readonly status?: ClinicMembershipStatus;
  readonly professionalRole?: ClinicProfessionalRole;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ClinicStaffInvitationRequest {
  readonly email: string;
  readonly professionalRole: ClinicAttachableRole;
}

export interface ClinicStaffLifecycleRequest {
  readonly expectedVersion: number;
}

export interface ClinicStaffSuspendRequest extends ClinicStaffLifecycleRequest {
  readonly reasonCode: ClinicSuspensionReason;
  readonly note?: string;
}

export const CLINIC_CASE_STATUSES = [
  'RECEIVED',
  'UNDER_ADMIN_REVIEW',
  'INFORMATION_REQUIRED',
  'READY_FOR_PLANNING',
  'DECLINED',
  'CANCELLED',
] as const;

export type ClinicCaseStatus = (typeof CLINIC_CASE_STATUSES)[number];

export const CLINIC_CASE_ACTIONS = [
  'START_REVIEW',
  'REQUEST_INFORMATION',
  'READY_FOR_PLANNING',
  'DECLINE',
] as const;

export type ClinicCaseAction = (typeof CLINIC_CASE_ACTIONS)[number];

export type ClinicCaseSubjectType = 'SELF' | 'FAMILY_MEMBER';

export type ClinicCaseSituation = 'APPOINTMENT' | 'URGENT' | 'AMBULANCE';

export type ClinicOperationalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type ClinicWorkflowStepKey = 'ADMINISTRATIVE_REVIEW' | 'REQUEST_COORDINATION';

export const CLINIC_CASE_DECLINE_REASON_CODES = [
  'NO_CAPACITY',
  'SERVICE_UNAVAILABLE',
  'REQUEST_NOT_SUPPORTED',
  'DUPLICATE_OR_INVALID_REQUEST',
  'OTHER_ADMINISTRATIVE',
] as const;

export type ClinicCaseDeclineReasonCode = (typeof CLINIC_CASE_DECLINE_REASON_CODES)[number];

export const CLINIC_INFORMATION_REASON_CODES = [
  'CONTACT_INFORMATION',
  'PATIENT_IDENTITY_INFORMATION',
  'FAMILY_MEMBER_INFORMATION',
  'REQUEST_ADMINISTRATIVE_DETAILS',
  'AVAILABILITY_INFORMATION',
  'OTHER_ADMINISTRATIVE',
] as const;

export type ClinicInformationReasonCode = (typeof CLINIC_INFORMATION_REASON_CODES)[number];
export type ClinicInformationResponseType =
  | 'CONFIRMATION'
  | 'WEEKDAY_AVAILABILITY'
  | 'CONTACT_PREFERENCE'
  | 'AVAILABILITY_WINDOWS'
  | 'IDENTITY_CONFIRMATION'
  | 'FAMILY_INFORMATION_CONFIRMATION'
  | 'ADMINISTRATIVE_SELECTION';
export type ClinicInformationRequestStatus = 'OPEN' | 'RESPONDED' | 'CANCELLED';

export interface ClinicCaseInformationRequest {
  readonly reasonCode: ClinicInformationReasonCode;
  readonly patientInstruction: string | null;
  readonly responseType: ClinicInformationResponseType;
  readonly status: ClinicInformationRequestStatus;
  readonly responseSummary?: string | null;
}

export interface ClinicCaseTimelineItem {
  readonly eventType: string;
  readonly previousStatus: ClinicCaseStatus | null;
  readonly newStatus: ClinicCaseStatus;
  readonly occurredAt: string;
}

export interface ClinicCaseListItem {
  readonly clinicCaseId: string;
  readonly patientDisplayName: string;
  readonly subjectType: ClinicCaseSubjectType;
  readonly relationship: string | null;
  readonly situation: ClinicCaseSituation;
  readonly administrativeStatus: ClinicCaseStatus;
  readonly submittedAt: string;
  readonly version: number;
  readonly priority: ClinicOperationalPriority;
  readonly currentStepKey: ClinicWorkflowStepKey;
  readonly availableActions: readonly ClinicCaseAction[];
  readonly hasOpenRoutingIncident: boolean;
}

/** Safe, case-scoped Profile projection. This is deliberately not a patient profile. */
export interface ClinicPatientOperationalSummary {
  readonly displayName: string;
  readonly subjectType: ClinicCaseSubjectType;
  readonly relationship: string | null;
}

export interface ClinicCaseQueueResponse {
  readonly contractVersion: string;
  readonly items: readonly ClinicCaseListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicCaseDetail extends Omit<ClinicCaseListItem, 'hasOpenRoutingIncident'> {
  readonly timeline: readonly ClinicCaseTimelineItem[];
  readonly informationRequest: ClinicCaseInformationRequest | null;
  readonly patientSummary: ClinicPatientOperationalSummary;
  readonly openRoutingIncidents: readonly ClinicOpenRoutingIncident[];
}

/** Typed for contract fidelity; incident UI is intentionally deferred beyond P3-13A. */
export interface ClinicOpenRoutingIncident {
  readonly id: string;
  readonly reasonCode: string;
  readonly responsibilityType: string;
  readonly createdAt: string;
}

export interface ClinicCaseQuery {
  readonly statuses?: readonly ClinicCaseStatus[];
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ClinicCaseTransitionRequest {
  readonly expectedVersion: number;
}

export interface ClinicCaseInformationRequiredRequest extends ClinicCaseTransitionRequest {
  readonly reasonCode: ClinicInformationReasonCode;
  readonly patientInstruction?: string;
}

export interface ClinicCaseDeclineRequest extends ClinicCaseTransitionRequest {
  readonly declineReasonCode: ClinicCaseDeclineReasonCode;
}

export const CLINIC_CASE_ERROR_CODES = [
  'CLINIC_CASE_NOT_FOUND',
  'CLINIC_CASE_TRANSITION_INVALID',
  'CLINIC_CASE_VERSION_CONFLICT',
  'CLINIC_STAFF_REQUEST_INVALID',
] as const;

export type ClinicCaseErrorCode = (typeof CLINIC_CASE_ERROR_CODES)[number];

export type ClinicCaseFailureReason =
  ClinicCaseErrorCode | ClinicAccessErrorCode | 'CLINIC_CASE_REQUEST_FAILED';

export function toClinicCaseErrorCode(value: unknown): ClinicCaseErrorCode | null {
  return typeof value === 'string' && (CLINIC_CASE_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ClinicCaseErrorCode)
    : null;
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
  return typeof value === 'string' &&
    (CLINIC_ACCESS_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ClinicAccessErrorCode)
    : null;
}

/** Capabilities that gate the Phase 1.5 staff surface. Authoritative source: bootstrap. */
export const CLINIC_STAFF_CAPABILITIES = [
  'CLINIC_STAFF_READ',
  'CLINIC_STAFF_INVITE',
  'CLINIC_STAFF_SUSPEND',
  'CLINIC_STAFF_REACTIVATE',
  'CLINIC_STAFF_END',
] as const;

export type ClinicStaffCapability = (typeof CLINIC_STAFF_CAPABILITIES)[number];

export const CLINIC_STAFF_ERROR_CODES = [
  'CLINIC_STAFF_CAPABILITY_REQUIRED',
  'CLINIC_STAFF_TARGET_FORBIDDEN',
  'CLINIC_STAFF_NOT_FOUND',
  'CLINIC_STAFF_REQUEST_INVALID',
  'CLINIC_PROFESSIONAL_NOT_ELIGIBLE',
  'CLINIC_PROFESSIONAL_ROLE_MISMATCH',
  'CLINIC_MEMBERSHIP_ALREADY_EXISTS',
  'CLINIC_MEMBERSHIP_VERSION_CONFLICT',
  'CLINIC_MEMBERSHIP_TRANSITION_INVALID',
] as const;

export type ClinicStaffErrorCode = (typeof CLINIC_STAFF_ERROR_CODES)[number];

/** Local-only staff failures that never come from the backend contract. */
export type ClinicStaffFailureReason = ClinicStaffErrorCode | 'CLINIC_STAFF_REQUEST_FAILED';

export function toClinicStaffErrorCode(value: unknown): ClinicStaffErrorCode | null {
  return typeof value === 'string' &&
    (CLINIC_STAFF_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ClinicStaffErrorCode)
    : null;
}

export function toClinicProfessionalRole(value: unknown): ClinicProfessionalRole | null {
  return typeof value === 'string' &&
    (CLINIC_PROFESSIONAL_ROLES as readonly string[]).includes(value)
    ? (value as ClinicProfessionalRole)
    : null;
}

/** Phase 3 task vocabulary. These values mirror the backend enums exactly. */
export const CLINIC_TASK_STATUSES = [
  'CREATED',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ClinicTaskStatus = (typeof CLINIC_TASK_STATUSES)[number];
export type ClinicTaskType = 'ADMINISTRATIVE_REVIEW' | 'REQUEST_COORDINATION';
export type ClinicResponsibilityType = 'ADMISSIONS' | 'REQUEST_COORDINATION';
export const CLINIC_GENERIC_TASK_BLOCK_REASONS = [
  'WAITING_FOR_INTERNAL_COORDINATION',
  'WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE',
  'WAITING_FOR_RESOURCE_AVAILABILITY',
] as const;

export type ClinicGenericTaskBlockReason = (typeof CLINIC_GENERIC_TASK_BLOCK_REASONS)[number];
export type ClinicTaskBlockedReasonCode =
  'WAITING_FOR_PATIENT_INFORMATION' | ClinicGenericTaskBlockReason;

export interface ClinicTaskCaseContext {
  readonly caseId: string;
  readonly sourceRequestId: string;
  readonly intakeStatus: ClinicCaseStatus;
  readonly situation: ClinicCaseSituation;
  readonly priority: ClinicOperationalPriority;
  readonly currentStepKey: ClinicWorkflowStepKey;
  readonly submittedAt: string;
  readonly hasOpenRoutingIncident: boolean;
}

export interface ClinicTaskListItem {
  readonly taskId: string;
  readonly caseId: string;
  readonly taskType: ClinicTaskType;
  readonly responsibilityType: ClinicResponsibilityType;
  readonly status: ClinicTaskStatus;
  readonly priority: ClinicOperationalPriority;
  readonly blocking: boolean;
  readonly acknowledgementRequired: boolean;
  readonly acknowledgementDueAt: string | null;
  readonly dueAt: string | null;
  readonly assignedPositionId: string | null;
  readonly assignedMembershipId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly caseContext: ClinicTaskCaseContext;
}

export interface ClinicTaskDetail extends ClinicTaskListItem {
  readonly blockedReasonCode: ClinicTaskBlockedReasonCode | null;
  readonly acknowledgedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface ClinicTaskPage {
  readonly contractVersion: string;
  readonly items: readonly ClinicTaskListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicTaskQuery {
  readonly status?: ClinicTaskStatus;
  readonly priority?: ClinicOperationalPriority;
  readonly taskType?: ClinicTaskType;
  readonly responsibilityType?: ClinicResponsibilityType;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ClinicTaskVersionRequest {
  readonly expectedVersion: number;
}

export interface ClinicTaskReassignmentRequest extends ClinicTaskVersionRequest {
  readonly targetPositionId: string;
}

export interface ClinicTaskBlockRequest extends ClinicTaskVersionRequest {
  readonly reasonCode: ClinicGenericTaskBlockReason;
}

export interface ClinicPosition {
  readonly id: string;
  readonly displayName: string;
  readonly requiredProfessionalRole: ClinicProfessionalRole | null;
  readonly scopeType: string;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClinicPositionPage {
  readonly contractVersion: string;
  readonly items: readonly ClinicPosition[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicPositionQuery { readonly active?: boolean; readonly page?: number; readonly pageSize?: number; }
export interface ClinicPositionCreateRequest { readonly displayName: string; readonly requiredProfessionalRole: ClinicProfessionalRole | null; readonly scopeType: 'CLINIC'; }
export interface ClinicPositionUpdateRequest { readonly displayName: string; readonly requiredProfessionalRole: ClinicProfessionalRole | null; readonly expectedVersion: number; }
export interface ClinicPositionAssignment { readonly id: string; readonly positionId: string; readonly membershipId: string; readonly assignedAt: string; readonly endedAt: string | null; readonly active: boolean; readonly version: number; readonly createdAt: string; readonly updatedAt: string; }
export interface ClinicPositionAssignmentPage { readonly contractVersion: string; readonly items: readonly ClinicPositionAssignment[]; readonly page: number; readonly pageSize: number; readonly hasNext: boolean; readonly generatedAt: string; }
export interface ClinicPositionAssignmentQuery { readonly positionId?: string; readonly membershipId?: string; readonly active?: boolean; readonly page?: number; readonly pageSize?: number; }
export interface ClinicPositionAssignmentCreateRequest { readonly positionId: string; readonly membershipId: string; }

export const CLINIC_RESPONSIBILITY_TYPES = ['ADMISSIONS', 'REQUEST_COORDINATION'] as const;
export interface ClinicResponsibility { readonly id: string; readonly responsibilityType: ClinicResponsibilityType; readonly scopeType: string; readonly primaryPositionId: string; readonly backupPositionId: string | null; readonly escalationPositionId: string | null; readonly active: boolean; readonly version: number; readonly createdAt: string; readonly updatedAt: string; }
export interface ClinicResponsibilityPage { readonly contractVersion: string; readonly items: readonly ClinicResponsibility[]; readonly page: number; readonly pageSize: number; readonly hasNext: boolean; readonly generatedAt: string; }
export interface ClinicResponsibilityQuery { readonly active?: boolean; readonly responsibilityType?: ClinicResponsibilityType; readonly page?: number; readonly pageSize?: number; }
export interface ClinicResponsibilityCreateRequest { readonly responsibilityType: ClinicResponsibilityType; readonly primaryPositionId: string; readonly backupPositionId?: string | null; readonly escalationPositionId?: string | null; }
export interface ClinicResponsibilityUpdateRequest { readonly primaryPositionId: string; readonly backupPositionId?: string | null; readonly escalationPositionId?: string | null; readonly expectedVersion: number; }

export const CLINIC_TASK_ERROR_CODES = [
  'CLINIC_TASK_NOT_FOUND',
  'CLINIC_TASK_VISIBILITY_FORBIDDEN',
  'CLINIC_TASK_ACKNOWLEDGEMENT_INVALID',
  'CLINIC_TASK_ACKNOWLEDGEMENT_NOT_REQUIRED',
  'CLINIC_TASK_VERSION_CONFLICT',
  'CLINIC_TASK_REASSIGN_CAPABILITY_REQUIRED',
  'CLINIC_TASK_REASSIGNMENT_INVALID',
  'CLINIC_TASK_REASSIGNMENT_NO_ELIGIBLE_POSITION',
  'CLINIC_TASK_NOT_IN_PROGRESS',
  'CLINIC_TASK_NOT_BLOCKED',
  'CLINIC_TASK_NOT_OWNER',
  'CLINIC_TASK_BLOCK_REASON_NOT_GENERIC',
  'CLINIC_TASK_GENERIC_COMPLETE_ADMINISTRATIVE_REVIEW',
] as const;

export type ClinicTaskErrorCode = (typeof CLINIC_TASK_ERROR_CODES)[number];
export type ClinicTaskFailureReason =
  ClinicTaskErrorCode | ClinicCaseErrorCode | ClinicAccessErrorCode | 'CLINIC_TASK_REQUEST_FAILED';

export function toClinicTaskErrorCode(value: unknown): ClinicTaskErrorCode | null {
  return typeof value === 'string' && (CLINIC_TASK_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ClinicTaskErrorCode)
    : null;
}

/** P3-11 operational routing incidents. Values mirror the backend enum contract. */
export const CLINIC_ROUTING_INCIDENT_TYPES = [
  'MISSING_ACTIVE_RESPONSIBILITY',
  'NO_ELIGIBLE_POSITION_QUEUE',
  'ROUTING_CONFIGURATION_DRIFT',
  'ACKNOWLEDGEMENT_ESCALATION_EXHAUSTED',
  'TASK_COMPLETION_OVERDUE',
] as const;
export type ClinicRoutingIncidentType = (typeof CLINIC_ROUTING_INCIDENT_TYPES)[number];
export type ClinicRoutingIncidentStatus = 'OPEN' | 'RESOLVED';
export type ClinicRoutingIncidentResolutionCode =
  | 'ROUTING_RESTORED'
  | 'TASK_ACKNOWLEDGED'
  | 'TASK_COMPLETED'
  | 'TASK_CANCELLED'
  | 'CONFIGURATION_REPAIRED';

export interface ClinicRoutingIncident {
  readonly id: string;
  readonly taskId: string;
  readonly caseId: string;
  readonly incidentType: ClinicRoutingIncidentType;
  readonly status: ClinicRoutingIncidentStatus;
  readonly openedAt: string;
  readonly lastObservedAt: string;
  readonly resolvedAt: string | null;
  readonly resolutionCode: ClinicRoutingIncidentResolutionCode | null;
  readonly version: number;
}

export interface ClinicRoutingIncidentPage {
  readonly items: readonly ClinicRoutingIncident[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicRoutingIncidentQuery {
  readonly status?: ClinicRoutingIncidentStatus;
  readonly type?: ClinicRoutingIncidentType;
  readonly page?: number;
  readonly size?: number;
}

/** P3-12 manual handover contract. */
export const CLINIC_HANDOVER_REASON_CODES = [
  'SHIFT_CHANGE',
  'BREAK_COVERAGE',
  'WORKLOAD_TRANSFER',
  'OTHER_OPERATIONAL',
] as const;
export type ClinicTaskHandoverReasonCode = (typeof CLINIC_HANDOVER_REASON_CODES)[number];
export type ClinicTaskHandoverStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'INVALIDATED';
export type ClinicTaskHandoverInvalidationReason =
  | 'TASK_TERMINAL'
  | 'TASK_REASSIGNED'
  | 'SOURCE_LOST_OWNERSHIP'
  | 'TARGET_INELIGIBLE';

export interface ClinicTaskHandover {
  readonly handoverId: string;
  readonly taskId: string;
  readonly status: ClinicTaskHandoverStatus;
  readonly reasonCode: ClinicTaskHandoverReasonCode;
  readonly fromMembershipId: string;
  readonly toMembershipId: string;
  readonly taskType: ClinicTaskType;
  readonly priority: ClinicOperationalPriority;
  readonly initiatedAt: string;
  readonly acceptedAt: string | null;
  readonly declinedAt: string | null;
  readonly cancelledAt: string | null;
  readonly invalidatedAt: string | null;
  readonly invalidationReason: ClinicTaskHandoverInvalidationReason | null;
}

export interface ClinicTaskHandoverPage {
  readonly items: readonly ClinicTaskHandover[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicTaskHandoverTarget {
  readonly membershipId: string;
  readonly displayName: string;
  readonly positionId: string;
  readonly positionName: string;
}

export interface ClinicTaskHandoverTargetPage {
  readonly items: readonly ClinicTaskHandoverTarget[];
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly generatedAt: string;
}

export interface ClinicTaskHandoverRequest {
  readonly toMembershipId: string;
  readonly reasonCode: ClinicTaskHandoverReasonCode;
  readonly expectedTaskVersion: number;
}
