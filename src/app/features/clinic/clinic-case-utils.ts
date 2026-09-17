import { HttpErrorResponse } from '@angular/common/http';

import { OcStatus } from '../../shared/ui';
import {
  ClinicCaseAction,
  ClinicCaseDeclineReasonCode,
  ClinicCaseFailureReason,
  ClinicInformationReasonCode,
  ClinicOperationalPriority,
  ClinicCaseSituation,
  ClinicCaseStatus,
  ClinicWorkflowStepKey,
  ClinicProblemDetail,
  toClinicAccessErrorCode,
  toClinicCaseErrorCode,
} from './clinic-api.models';

export interface ClinicCaseOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export const CLINIC_CASE_STATUS_OPTIONS: readonly ClinicCaseOption<ClinicCaseStatus>[] = [
  { value: 'RECEIVED', label: 'New' },
  { value: 'UNDER_ADMIN_REVIEW', label: 'Under review' },
  { value: 'INFORMATION_REQUIRED', label: 'Waiting for information' },
  { value: 'READY_FOR_PLANNING', label: 'Ready for planning' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const CLINIC_CASE_SITUATION_OPTIONS: readonly ClinicCaseOption<ClinicCaseSituation>[] = [
  { value: 'APPOINTMENT', label: 'Appointment' },
  { value: 'URGENT', label: 'Urgent request' },
  { value: 'AMBULANCE', label: 'Ambulance request' },
];

export const CLINIC_PRIORITY_OPTIONS: readonly ClinicCaseOption<ClinicOperationalPriority>[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const CLINIC_WORKFLOW_STEP_OPTIONS: readonly ClinicCaseOption<ClinicWorkflowStepKey>[] = [
  { value: 'ADMINISTRATIVE_REVIEW', label: 'Administrative review' },
  { value: 'REQUEST_COORDINATION', label: 'Request coordination' },
];

export const CLINIC_CASE_DECLINE_REASON_OPTIONS: readonly ClinicCaseOption<ClinicCaseDeclineReasonCode>[] = [
  { value: 'NO_CAPACITY', label: 'No capacity available' },
  { value: 'SERVICE_UNAVAILABLE', label: 'Service unavailable' },
  { value: 'REQUEST_NOT_SUPPORTED', label: 'Request not supported' },
  { value: 'DUPLICATE_OR_INVALID_REQUEST', label: 'Duplicate or invalid request' },
  { value: 'OTHER_ADMINISTRATIVE', label: 'Other administrative reason' },
];

export const CLINIC_INFORMATION_REASON_OPTIONS: readonly ClinicCaseOption<ClinicInformationReasonCode>[] = [
  { value: 'CONTACT_INFORMATION', label: 'Contact information' },
  { value: 'PATIENT_IDENTITY_INFORMATION', label: 'Patient identity information' },
  { value: 'FAMILY_MEMBER_INFORMATION', label: 'Family member information' },
  { value: 'REQUEST_ADMINISTRATIVE_DETAILS', label: 'Request administrative details' },
  { value: 'AVAILABILITY_INFORMATION', label: 'Availability information' },
  { value: 'OTHER_ADMINISTRATIVE', label: 'Other administrative information' },
];

const ACTION_LABELS: Readonly<Record<ClinicCaseAction, string>> = {
  START_REVIEW: 'Start review',
  REQUEST_INFORMATION: 'Request information',
  READY_FOR_PLANNING: 'Ready for planning',
  DECLINE: 'Decline request',
};

const ACTION_ICONS: Readonly<Record<ClinicCaseAction, string>> = {
  START_REVIEW: 'audit',
  REQUEST_INFORMATION: 'exclamation-circle',
  READY_FOR_PLANNING: 'check-circle',
  DECLINE: 'close-circle',
};

const FAILURE_MESSAGES: Readonly<Record<ClinicCaseFailureReason, string>> = {
  CLINIC_CASE_NOT_FOUND: 'This request is no longer available. The queue has been refreshed.',
  CLINIC_CASE_TRANSITION_INVALID: 'This request changed state. Latest information loaded.',
  CLINIC_CASE_VERSION_CONFLICT: 'This request changed while you were viewing it. Latest information loaded.',
  CLINIC_STAFF_REQUEST_INVALID: 'The action could not be sent. Check the selected reason and try again.',
  CLINIC_CONTEXT_UNAVAILABLE: 'Your clinic workspace is not available at the moment.',
  CLINIC_SCOPE_FORBIDDEN: 'You are not allowed to open this clinic workspace.',
  CLINIC_MEMBERSHIP_SUSPENDED: 'Your membership for this clinic is currently suspended.',
  CLINIC_MEMBERSHIP_ENDED: 'Your membership for this clinic has ended.',
  CLINIC_MEMBERSHIP_REQUIRED: 'An active clinic membership is required to open this workspace.',
  CLINIC_NOT_ACTIVE: 'This clinic is not active, so its workspace cannot be opened.',
  CLINIC_PROFESSIONAL_ROLE_INVALID: 'Your professional role cannot open this clinic workspace.',
  CLINIC_CAPABILITY_FORBIDDEN: 'You do not have permission for this part of the clinic workspace.',
  CLINIC_CASE_REQUEST_FAILED: 'Requests could not be loaded. Try again.',
};

export function clinicCaseStatusLabel(status: ClinicCaseStatus): string {
  return CLINIC_CASE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? humanize(status);
}

export function clinicCaseSituationLabel(situation: ClinicCaseSituation): string {
  return CLINIC_CASE_SITUATION_OPTIONS.find((option) => option.value === situation)?.label ?? humanize(situation);
}

export function clinicPriorityLabel(priority: ClinicOperationalPriority): string {
  return CLINIC_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? humanize(priority);
}

export function clinicWorkflowStepLabel(step: ClinicWorkflowStepKey): string {
  return CLINIC_WORKFLOW_STEP_OPTIONS.find((option) => option.value === step)?.label ?? humanize(step);
}

/** The backend currently exposes a UUID only; this is display shorthand, never a new identifier. */
export function clinicCaseReference(caseId: string): string {
  const compact = caseId.replaceAll('-', '').slice(0, 8).toLocaleUpperCase();
  return `#${compact || caseId}`;
}

export function clinicCaseDeclineReasonLabel(reason: ClinicCaseDeclineReasonCode): string {
  return CLINIC_CASE_DECLINE_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? humanize(reason);
}

export function clinicInformationReasonLabel(reason: ClinicInformationReasonCode): string {
  return CLINIC_INFORMATION_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? humanize(reason);
}

/** Informational copy only. The backend, never this UI, selects the response contract. */
export function clinicInformationResponseExplanation(reason: ClinicInformationReasonCode | null): readonly string[] {
  switch (reason) {
    case 'AVAILABILITY_INFORMATION': return ['available weekday(s)', 'preferred time ranges'];
    case 'CONTACT_INFORMATION': return ['preferred contact method', 'confirmation that current profile contact details are accurate'];
    case 'PATIENT_IDENTITY_INFORMATION': return ['confirmation that identity information is current'];
    case 'FAMILY_MEMBER_INFORMATION': return ['confirmation that family member information is current'];
    case 'REQUEST_ADMINISTRATIVE_DETAILS':
    case 'OTHER_ADMINISTRATIVE': return ['explicit administrative confirmation'];
    default: return [];
  }
}

export function clinicCaseActionLabel(action: ClinicCaseAction): string {
  return ACTION_LABELS[action] ?? humanize(action);
}

export function clinicCaseActionIcon(action: ClinicCaseAction): string {
  return ACTION_ICONS[action] ?? 'audit';
}

export function clinicCaseStatusTone(status: ClinicCaseStatus): OcStatus {
  if (status === 'READY_FOR_PLANNING') return 'confirmed';
  if (status === 'DECLINED' || status === 'CANCELLED') return 'cancelled';
  if (status === 'UNDER_ADMIN_REVIEW') return 'in-progress';
  if (status === 'INFORMATION_REQUIRED') return 'requires-attention';
  return 'pending';
}

export function isTerminalClinicCase(status: ClinicCaseStatus): boolean {
  return status === 'DECLINED' || status === 'CANCELLED';
}

export function clinicCaseFailureMessage(reason: ClinicCaseFailureReason): string {
  return FAILURE_MESSAGES[reason] ?? FAILURE_MESSAGES.CLINIC_CASE_REQUEST_FAILED;
}

export function readClinicCaseFailureReason(error: unknown): ClinicCaseFailureReason {
  if (!(error instanceof HttpErrorResponse)) return 'CLINIC_CASE_REQUEST_FAILED';
  const body = error.error as ClinicProblemDetail | null;
  const caseCode = toClinicCaseErrorCode(body?.errorCode);
  if (caseCode !== null) return caseCode;
  const accessCode = toClinicAccessErrorCode(body?.errorCode);
  if (accessCode !== null) return accessCode;
  if (error.status === 404) return 'CLINIC_CASE_NOT_FOUND';
  if (error.status === 403) return 'CLINIC_SCOPE_FORBIDDEN';
  if (error.status === 400) return 'CLINIC_STAFF_REQUEST_INVALID';
  return 'CLINIC_CASE_REQUEST_FAILED';
}

export function isClinicCaseVersionConflict(reason: ClinicCaseFailureReason): boolean {
  return reason === 'CLINIC_CASE_VERSION_CONFLICT';
}

export function isClinicCaseRefreshableConflict(reason: ClinicCaseFailureReason): boolean {
  return reason === 'CLINIC_CASE_VERSION_CONFLICT' || reason === 'CLINIC_CASE_TRANSITION_INVALID';
}

function humanize(value: string): string {
  const text = value.toLocaleLowerCase().replaceAll('_', ' ');
  return text.length === 0 ? '' : text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
