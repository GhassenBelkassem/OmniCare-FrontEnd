import {
  ClinicTaskHandoverInvalidationReason,
  ClinicTaskHandoverReasonCode,
  ClinicTaskHandoverStatus,
} from './clinic-api.models';

const STATUS_LABELS: Record<ClinicTaskHandoverStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  INVALIDATED: 'No longer available',
};
const REASON_LABELS: Record<ClinicTaskHandoverReasonCode, string> = {
  SHIFT_CHANGE: 'Shift change',
  BREAK_COVERAGE: 'Break coverage',
  WORKLOAD_TRANSFER: 'Workload transfer',
  OTHER_OPERATIONAL: 'Other operational reason',
};
const INVALIDATION_LABELS: Record<ClinicTaskHandoverInvalidationReason, string> = {
  TASK_TERMINAL: 'The task is no longer active.',
  TASK_REASSIGNED: 'The task was reassigned.',
  SOURCE_LOST_OWNERSHIP: 'The source is no longer the task owner.',
  TARGET_INELIGIBLE: 'The target is no longer eligible.',
};

export function clinicHandoverStatusLabel(status: ClinicTaskHandoverStatus): string {
  return STATUS_LABELS[status];
}
export function clinicHandoverReasonLabel(reason: ClinicTaskHandoverReasonCode): string {
  return REASON_LABELS[reason];
}
export function clinicHandoverInvalidationLabel(
  reason: ClinicTaskHandoverInvalidationReason | null,
): string {
  return reason === null ? 'This handover is no longer available.' : INVALIDATION_LABELS[reason];
}
