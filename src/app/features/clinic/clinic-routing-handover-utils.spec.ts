import { CLINIC_HANDOVER_REASON_CODES, CLINIC_ROUTING_INCIDENT_TYPES } from './clinic-api.models';
import { clinicHandoverInvalidationLabel, clinicHandoverReasonLabel, clinicHandoverStatusLabel } from './clinic-handover-utils';
import { clinicRoutingIncidentTypeLabel, isRetryableRoutingIncident } from './clinic-routing-incident-utils';

describe('routing incident and handover enum copy', () => {
  it('humanizes every backend incident enum and keeps retry eligibility bounded', () => {
    expect(CLINIC_ROUTING_INCIDENT_TYPES.map(clinicRoutingIncidentTypeLabel)).toEqual([
      'Missing active responsibility', 'No eligible position queue', 'Routing configuration changed',
      'Acknowledgement escalation exhausted', 'Task completion overdue',
    ]);
    expect(isRetryableRoutingIncident('TASK_COMPLETION_OVERDUE')).toBe(false);
    expect(isRetryableRoutingIncident('ACKNOWLEDGEMENT_ESCALATION_EXHAUSTED')).toBe(false);
  });
  it('humanizes controlled handover states, reasons, and invalidations', () => {
    expect(CLINIC_HANDOVER_REASON_CODES.map(clinicHandoverReasonLabel)).toEqual([
      'Shift change', 'Break coverage', 'Workload transfer', 'Other operational reason',
    ]);
    expect(clinicHandoverStatusLabel('INVALIDATED')).toBe('No longer available');
    expect(clinicHandoverInvalidationLabel('TASK_TERMINAL')).toContain('no longer active');
  });
});
