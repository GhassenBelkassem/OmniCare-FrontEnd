import {
  ClinicRoutingIncidentResolutionCode,
  ClinicRoutingIncidentStatus,
  ClinicRoutingIncidentType,
} from './clinic-api.models';

const TYPE_LABELS: Record<ClinicRoutingIncidentType, string> = {
  MISSING_ACTIVE_RESPONSIBILITY: 'Missing active responsibility',
  NO_ELIGIBLE_POSITION_QUEUE: 'No eligible position queue',
  ROUTING_CONFIGURATION_DRIFT: 'Routing configuration changed',
  ACKNOWLEDGEMENT_ESCALATION_EXHAUSTED: 'Acknowledgement escalation exhausted',
  TASK_COMPLETION_OVERDUE: 'Task completion overdue',
};

const RESOLUTION_LABELS: Record<ClinicRoutingIncidentResolutionCode, string> = {
  ROUTING_RESTORED: 'Routing restored',
  TASK_ACKNOWLEDGED: 'Task acknowledged',
  TASK_COMPLETED: 'Task completed',
  TASK_CANCELLED: 'Task cancelled',
  CONFIGURATION_REPAIRED: 'Configuration repaired',
};

export function clinicRoutingIncidentTypeLabel(type: ClinicRoutingIncidentType): string {
  return TYPE_LABELS[type];
}

export function clinicRoutingIncidentResolutionLabel(
  resolution: ClinicRoutingIncidentResolutionCode | null,
): string {
  return resolution === null ? 'Not recorded' : RESOLUTION_LABELS[resolution];
}

export function clinicRoutingIncidentStatusLabel(status: ClinicRoutingIncidentStatus): string {
  return status === 'OPEN' ? 'Open' : 'Resolved';
}

/** Retry eligibility is the bounded server contract; backend revalidates it on command. */
export function isRetryableRoutingIncident(type: ClinicRoutingIncidentType): boolean {
  return (
    type === 'MISSING_ACTIVE_RESPONSIBILITY' ||
    type === 'NO_ELIGIBLE_POSITION_QUEUE' ||
    type === 'ROUTING_CONFIGURATION_DRIFT'
  );
}
