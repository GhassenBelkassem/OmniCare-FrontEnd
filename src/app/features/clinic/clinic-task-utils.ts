import { HttpErrorResponse } from '@angular/common/http';

import { OcStatus } from '../../shared/ui';
import {
  ClinicProblemDetail,
  ClinicGenericTaskBlockReason,
  ClinicTaskBlockedReasonCode,
  ClinicTaskFailureReason,
  ClinicTaskListItem,
  ClinicTaskStatus,
  ClinicTaskType,
  toClinicAccessErrorCode,
  toClinicCaseErrorCode,
  toClinicTaskErrorCode,
} from './clinic-api.models';

const TASK_FAILURE_MESSAGES: Readonly<Record<ClinicTaskFailureReason, string>> = {
  CLINIC_TASK_NOT_FOUND: 'This task is unavailable or you do not have access to it.',
  CLINIC_TASK_VISIBILITY_FORBIDDEN: 'This task is unavailable or you do not have access to it.',
  CLINIC_TASK_ACKNOWLEDGEMENT_INVALID: 'This task can no longer be acknowledged.',
  CLINIC_TASK_ACKNOWLEDGEMENT_NOT_REQUIRED: 'This task does not require acknowledgement.',
  CLINIC_TASK_VERSION_CONFLICT:
    'This task changed while you were viewing it. The latest information has been loaded.',
  CLINIC_TASK_REASSIGN_CAPABILITY_REQUIRED: 'You do not have permission to reassign this task.',
  CLINIC_TASK_REASSIGNMENT_INVALID: 'This task cannot be reassigned to that position.',
  CLINIC_TASK_REASSIGNMENT_NO_ELIGIBLE_POSITION:
    'The target position has no eligible active team member.',
  CLINIC_TASK_NOT_IN_PROGRESS:
    'This task is no longer in progress. The latest information has been loaded.',
  CLINIC_TASK_NOT_BLOCKED:
    'This task is no longer blocked. The latest information has been loaded.',
  CLINIC_TASK_NOT_OWNER: 'This task is unavailable or you do not have access to it.',
  CLINIC_TASK_BLOCK_REASON_NOT_GENERIC:
    'This block reason is controlled by another clinic workflow.',
  CLINIC_TASK_GENERIC_COMPLETE_ADMINISTRATIVE_REVIEW:
    'Administrative review must use the ready-for-planning operation.',
  CLINIC_CASE_NOT_FOUND: 'The request for this task is unavailable.',
  CLINIC_CASE_TRANSITION_INVALID:
    'This task changed while you were viewing it. The latest information has been loaded.',
  CLINIC_CASE_VERSION_CONFLICT:
    'This task changed while you were viewing it. The latest information has been loaded.',
  CLINIC_STAFF_REQUEST_INVALID:
    'The action could not be completed. Check the information and try again.',
  CLINIC_CONTEXT_UNAVAILABLE: 'Your clinic workspace is not available at the moment.',
  CLINIC_SCOPE_FORBIDDEN: 'This task is unavailable or you do not have access to it.',
  CLINIC_MEMBERSHIP_SUSPENDED: 'Your clinic membership is currently suspended.',
  CLINIC_MEMBERSHIP_ENDED: 'Your clinic membership has ended.',
  CLINIC_MEMBERSHIP_REQUIRED: 'An active clinic membership is required.',
  CLINIC_NOT_ACTIVE: 'This clinic is not active.',
  CLINIC_PROFESSIONAL_ROLE_INVALID: 'Your role cannot access this clinic task.',
  CLINIC_CAPABILITY_FORBIDDEN: 'You do not have permission for this task surface.',
  CLINIC_TASK_REQUEST_FAILED: 'Tasks could not be loaded. Try again.',
};

export function clinicTaskStatusLabel(status: ClinicTaskStatus): string {
  const labels: Readonly<Record<ClinicTaskStatus, string>> = {
    CREATED: 'Awaiting routing',
    ASSIGNED: 'Awaiting acknowledgement',
    ACKNOWLEDGED: 'Ready to start',
    IN_PROGRESS: 'In progress',
    BLOCKED: 'Blocked',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status];
}

export function clinicTaskStatusTone(status: ClinicTaskStatus): OcStatus {
  if (status === 'IN_PROGRESS') return 'in-progress';
  if (status === 'BLOCKED') return 'blocked';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'ACKNOWLEDGED') return 'confirmed';
  return 'pending';
}

export function clinicTaskTypeLabel(type: ClinicTaskType): string {
  return type === 'ADMINISTRATIVE_REVIEW' ? 'Administrative review' : 'Request coordination';
}

export function clinicTaskBlockedReasonLabel(reason: ClinicTaskBlockedReasonCode): string {
  const labels: Readonly<Record<ClinicTaskBlockedReasonCode, string>> = {
    WAITING_FOR_PATIENT_INFORMATION: 'Waiting for patient information',
    WAITING_FOR_INTERNAL_COORDINATION: 'Waiting for internal coordination',
    WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE: 'Waiting for an external non-patient response',
    WAITING_FOR_RESOURCE_AVAILABILITY: 'Waiting for resource availability',
  };
  return labels[reason];
}

export function isGenericTaskBlockReason(
  reason: ClinicTaskBlockedReasonCode | null,
): reason is ClinicGenericTaskBlockReason {
  return (
    reason === 'WAITING_FOR_INTERNAL_COORDINATION' ||
    reason === 'WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE' ||
    reason === 'WAITING_FOR_RESOURCE_AVAILABILITY'
  );
}

export function isAcknowledgementOverdue(
  task: Pick<ClinicTaskListItem, 'acknowledgementRequired' | 'acknowledgementDueAt'> & {
    readonly acknowledgedAt: string | null;
  },
  now = Date.now(),
): boolean {
  if (!task.acknowledgementRequired || task.acknowledgementDueAt === null) return false;

  const acknowledgementDueAt = Date.parse(task.acknowledgementDueAt);
  if (Number.isNaN(acknowledgementDueAt)) return false;

  if (task.acknowledgedAt !== null) {
    const acknowledgedAt = Date.parse(task.acknowledgedAt);
    return !Number.isNaN(acknowledgedAt) && acknowledgedAt > acknowledgementDueAt;
  }

  return now > acknowledgementDueAt;
}

export function isTaskDeadlineOverdue(
  status: ClinicTaskStatus,
  dueAt: string | null,
  now = Date.now(),
): boolean {
  if (dueAt === null || status === 'COMPLETED' || status === 'CANCELLED') return false;
  const timestamp = Date.parse(dueAt);
  return !Number.isNaN(timestamp) && now > timestamp;
}

export function clinicTaskReference(taskId: string): string {
  const compact = taskId.replaceAll('-', '').slice(0, 8).toLocaleUpperCase();
  return `#${compact || taskId}`;
}

export function clinicTaskFailureMessage(reason: ClinicTaskFailureReason): string {
  return TASK_FAILURE_MESSAGES[reason] ?? TASK_FAILURE_MESSAGES.CLINIC_TASK_REQUEST_FAILED;
}

export function readClinicTaskFailureReason(error: unknown): ClinicTaskFailureReason {
  if (!(error instanceof HttpErrorResponse)) return 'CLINIC_TASK_REQUEST_FAILED';
  const body = error.error as ClinicProblemDetail | null;
  const taskCode = toClinicTaskErrorCode(body?.errorCode);
  if (taskCode !== null) return taskCode;
  const caseCode = toClinicCaseErrorCode(body?.errorCode);
  if (caseCode !== null) return caseCode;
  const accessCode = toClinicAccessErrorCode(body?.errorCode);
  if (accessCode !== null) return accessCode;
  if (error.status === 404) return 'CLINIC_TASK_NOT_FOUND';
  if (error.status === 403) return 'CLINIC_TASK_VISIBILITY_FORBIDDEN';
  if (error.status === 409) return 'CLINIC_TASK_VERSION_CONFLICT';
  return 'CLINIC_TASK_REQUEST_FAILED';
}

export function isTaskVersionConflict(reason: ClinicTaskFailureReason): boolean {
  return (
    reason === 'CLINIC_TASK_VERSION_CONFLICT' ||
    reason === 'CLINIC_CASE_VERSION_CONFLICT' ||
    reason === 'CLINIC_CASE_TRANSITION_INVALID'
  );
}

function humanize(value: string): string {
  const text = value.toLocaleLowerCase().replaceAll('_', ' ');
  return text.length === 0 ? '' : text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
