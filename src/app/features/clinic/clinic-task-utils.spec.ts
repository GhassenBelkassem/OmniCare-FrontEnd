import { CLINIC_GENERIC_TASK_BLOCK_REASONS } from './clinic-api.models';
import {
  clinicTaskBlockedReasonLabel,
  isAcknowledgementOverdue,
  isGenericTaskBlockReason,
} from './clinic-task-utils';

describe('clinic task generic block reasons', () => {
  it('maps each backend-approved generic reason to controlled human-readable copy', () => {
    expect(clinicTaskBlockedReasonLabel('WAITING_FOR_INTERNAL_COORDINATION')).toBe(
      'Waiting for internal coordination',
    );
    expect(clinicTaskBlockedReasonLabel('WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE')).toBe(
      'Waiting for an external non-patient response',
    );
    expect(clinicTaskBlockedReasonLabel('WAITING_FOR_RESOURCE_AVAILABILITY')).toBe(
      'Waiting for resource availability',
    );
  });

  it('excludes patient information from the generic selector and unblock predicate', () => {
    expect(CLINIC_GENERIC_TASK_BLOCK_REASONS).toEqual([
      'WAITING_FOR_INTERNAL_COORDINATION',
      'WAITING_FOR_EXTERNAL_NON_PATIENT_RESPONSE',
      'WAITING_FOR_RESOURCE_AVAILABILITY',
    ]);
    expect(CLINIC_GENERIC_TASK_BLOCK_REASONS).not.toContain('WAITING_FOR_PATIENT_INFORMATION');
    expect(isGenericTaskBlockReason('WAITING_FOR_PATIENT_INFORMATION')).toBe(false);
  });
});

describe('clinic task acknowledgement SLA', () => {
  const acknowledgementDueAt = '2026-08-13T13:56:00Z';

  it.each([
    ['acknowledged before the deadline', '2026-08-13T13:48:00Z', '2026-08-13T15:00:00Z', false],
    ['acknowledged after the deadline', '2026-08-13T14:00:00Z', '2026-08-13T15:00:00Z', true],
    ['pending before the deadline', null, '2026-08-13T13:55:00Z', false],
    ['pending after the deadline', null, '2026-08-13T13:57:00Z', true],
  ] as const)('%s uses the authoritative acknowledgement timestamp semantics', (_, acknowledgedAt, now, expected) => {
    expect(
      isAcknowledgementOverdue(
        taskForAcknowledgementSla({ acknowledgementDueAt, acknowledgedAt }),
        Date.parse(now),
      ),
    ).toBe(expected);
  });

  it('does not calculate acknowledgement overdue status without a required deadline', () => {
    expect(
      isAcknowledgementOverdue(
        taskForAcknowledgementSla({ acknowledgementDueAt: null, acknowledgedAt: null }),
        Date.parse('2026-08-13T15:00:00Z'),
      ),
    ).toBe(false);
    expect(
      isAcknowledgementOverdue(
        taskForAcknowledgementSla({ acknowledgementRequired: false, acknowledgementDueAt }),
        Date.parse('2026-08-13T15:00:00Z'),
      ),
    ).toBe(false);
  });
});

function taskForAcknowledgementSla(
  overrides: Partial<{
    acknowledgementRequired: boolean;
    acknowledgementDueAt: string | null;
    acknowledgedAt: string | null;
  }>,
): { acknowledgementRequired: boolean; acknowledgementDueAt: string | null; acknowledgedAt: string | null } {
  return {
    acknowledgementRequired: true,
    acknowledgementDueAt: null,
    acknowledgedAt: null,
    ...overrides,
  };
}
