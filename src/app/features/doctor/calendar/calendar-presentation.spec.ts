import { describe, expect, it } from 'vitest';

import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import {
  CALENDAR_STATES,
  NOT_CLOSED_CLASS,
  isNotClosed,
  presentCalendarItem,
  type CalendarState,
} from './calendar-presentation';

function item(
  overrides: Partial<DoctorScheduledCareItem> & { subjectType?: string } = {},
): DoctorScheduledCareItem {
  const { subjectType = 'SELF', ...rest } = overrides;
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: 'appointment-1',
    sourceBookingRequestId: null,
    version: 1,
    status: 'CONFIRMED',
    doctor: { displayName: 'Dr Test', specialty: null },
    subject: { subjectType, displayName: 'Test Patient', relationship: null },
    cabinet: {
      name: 'Cabinet Test',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    start: '2031-04-08T09:00:00.000Z',
    end: '2031-04-08T09:30:00.000Z',
    timezone: 'Africa/Tunis',
    responseDeadline: null,
    cancellation: null,
    intakeStatus: null,
    availableActions: [],
    sortAt: '2031-04-08T09:00:00.000Z',
    updatedAt: '2031-04-08T08:00:00.000Z',
    ...rest,
  };
}

describe('presentCalendarItem', () => {
  const cases: ReadonlyArray<{
    name: string;
    input: Partial<DoctorScheduledCareItem>;
    followUp?: boolean;
    state: CalendarState;
    label: string;
    dashed: boolean;
    struck: boolean;
  }> = [
    {
      name: 'pending doctor request',
      input: { resourceType: 'BOOKING_REQUEST', status: 'PENDING_DOCTOR' },
      state: 'request',
      label: 'Demande',
      dashed: true,
      struck: false,
    },
    {
      name: 'request waiting for the patient',
      input: { resourceType: 'BOOKING_REQUEST', status: 'PENDING_PATIENT_TIME_CONFIRMATION' },
      state: 'waitingPatient',
      label: 'En attente du patient',
      dashed: true,
      struck: false,
    },
    {
      name: 'proposed appointment',
      input: { status: 'PROPOSED' },
      state: 'waitingPatient',
      label: 'En attente du patient',
      dashed: true,
      struck: false,
    },
    {
      name: 'confirmed appointment',
      input: { status: 'CONFIRMED' },
      state: 'upcoming',
      label: 'À venir',
      dashed: false,
      struck: false,
    },
    {
      name: 'confirmed follow-up',
      input: { status: 'CONFIRMED' },
      followUp: true,
      state: 'followUpUpcoming',
      label: 'Suivi à venir',
      dashed: false,
      struck: false,
    },
    {
      name: 'in progress',
      input: { status: 'IN_PROGRESS' },
      state: 'inProgress',
      label: 'En cours',
      dashed: false,
      struck: false,
    },
    {
      name: 'completed',
      input: { status: 'COMPLETED' },
      state: 'done',
      label: 'Terminé',
      dashed: false,
      struck: false,
    },
    {
      name: 'completed follow-up',
      input: { status: 'COMPLETED' },
      followUp: true,
      state: 'followUpDone',
      label: 'Suivi terminé',
      dashed: false,
      struck: false,
    },
    {
      name: 'no-show',
      input: { status: 'NO_SHOW' },
      state: 'absent',
      label: 'Absent',
      dashed: false,
      struck: false,
    },
    {
      name: 'cancelled',
      input: { status: 'CANCELLED' },
      state: 'cancelled',
      label: 'Annulé',
      dashed: false,
      struck: true,
    },
  ];

  for (const testCase of cases) {
    it(`maps ${testCase.name}`, () => {
      const result = presentCalendarItem(item(testCase.input), { isFollowUp: testCase.followUp });
      expect(result.state).toBe(testCase.state);
      expect(result.labelFr).toBe(testCase.label);
      expect(result.dashed).toBe(testCase.dashed);
      expect(result.struck).toBe(testCase.struck);
      expect(result.cssClass).toBe(`oc-cal-state--${testCase.state}`);
    });
  }

  it('defaults isFollowUp to false when opts is omitted or empty', () => {
    expect(presentCalendarItem(item({ status: 'CONFIRMED' })).state).toBe('upcoming');
    expect(presentCalendarItem(item({ status: 'COMPLETED' }), {}).state).toBe('done');
  });

  it('ignores the follow-up marker for states that have no follow-up variant', () => {
    expect(presentCalendarItem(item({ status: 'IN_PROGRESS' }), { isFollowUp: true }).state).toBe(
      'inProgress',
    );
    expect(presentCalendarItem(item({ status: 'NO_SHOW' }), { isFollowUp: true }).state).toBe(
      'absent',
    );
    expect(presentCalendarItem(item({ status: 'CANCELLED' }), { isFollowUp: true }).state).toBe(
      'cancelled',
    );
  });

  it('falls back to the neutral state for an unknown status without throwing', () => {
    const unknown = item({ status: 'SOMETHING_NEW' as DoctorScheduledCareItem['status'] });
    const result = presentCalendarItem(unknown);
    expect(result).toMatchObject({
      state: 'neutral',
      labelFr: 'Rendez-vous',
      dashed: false,
      struck: false,
      cssClass: 'oc-cal-state--neutral',
    });
  });

  it('falls back to neutral for an unknown resource type and for closed request statuses', () => {
    expect(
      presentCalendarItem(
        item({ resourceType: 'SOMETHING' as DoctorScheduledCareItem['resourceType'] }),
      ).state,
    ).toBe('neutral');
    expect(
      presentCalendarItem(item({ resourceType: 'BOOKING_REQUEST', status: 'EXPIRED' })).state,
    ).toBe('neutral');
    expect(
      presentCalendarItem(item({ resourceType: 'BOOKING_REQUEST', status: 'CONFIRMED' })).state,
    ).toBe('neutral');
  });

  it('does not mix the request and appointment status families', () => {
    expect(
      presentCalendarItem(item({ resourceType: 'APPOINTMENT', status: 'PENDING_DOCTOR' })).state,
    ).toBe('neutral');
  });

  it('uses the external icon for practice patients and the cabinet icon otherwise', () => {
    expect(presentCalendarItem(item({ subjectType: 'PRACTICE_PATIENT' })).typeIcon).toBe('external');
    expect(presentCalendarItem(item({ subjectType: 'SELF' })).typeIcon).toBe('cabinet');
    expect(presentCalendarItem(item({ subjectType: 'FAMILY_MEMBER' })).typeIcon).toBe('cabinet');
    expect(presentCalendarItem(item({ subjectType: 'UNKNOWN_TYPE' })).typeIcon).toBe('cabinet');
  });

  it('uses the same icon rule for booking requests', () => {
    const request = item({
      resourceType: 'BOOKING_REQUEST',
      status: 'PENDING_DOCTOR',
      subjectType: 'PRACTICE_PATIENT',
    });
    expect(presentCalendarItem(request).typeIcon).toBe('external');
  });

  it('exposes every state exactly once with a French label and a css hook', () => {
    expect(new Set(CALENDAR_STATES).size).toBe(CALENDAR_STATES.length);
    expect(CALENDAR_STATES).toHaveLength(10);
    for (const state of CALENDAR_STATES) {
      const sample = presentCalendarItem(
        item(
          state === 'request'
            ? { resourceType: 'BOOKING_REQUEST', status: 'PENDING_DOCTOR' }
            : { status: 'CONFIRMED' },
        ),
      );
      expect(sample.cssClass).toMatch(/^oc-cal-state--[A-Za-z]+$/);
    }
  });

  it('does not mutate its input', () => {
    const input = item({ status: 'CANCELLED' });
    const snapshot = JSON.stringify(input);
    presentCalendarItem(input, { isFollowUp: true });
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  describe('fix 5: « Non clôturé » for a confirmed appointment already over', () => {
    const END = Date.parse('2031-04-08T09:30:00.000Z');

    it('turns « À venir » and « Suivi à venir » into « Non clôturé » once the end is past, keeping the state for the filters', () => {
      const plain = presentCalendarItem(item(), { nowMs: END + 60_000 });
      expect(plain).toMatchObject({ state: 'upcoming', labelFr: 'Non clôturé', notClosed: true });
      expect(plain.cssClass).toBe(`oc-cal-state--upcoming ${NOT_CLOSED_CLASS}`);
      const follow = presentCalendarItem(item(), { isFollowUp: true, nowMs: END + 60_000 });
      expect(follow).toMatchObject({ state: 'followUpUpcoming', labelFr: 'Non clôturé', notClosed: true });
    });

    it('counts the exact end instant as past and stays « À venir » before it', () => {
      expect(presentCalendarItem(item(), { nowMs: END }).labelFr).toBe('Non clôturé');
      expect(presentCalendarItem(item(), { nowMs: END - 1 })).toMatchObject({ labelFr: 'À venir', notClosed: false });
    });

    it('never applies to other statuses, to requests, or without a clock', () => {
      for (const status of ['PROPOSED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) {
        expect(presentCalendarItem(item({ status }), { nowMs: END + 1 }).notClosed).toBe(false);
      }
      expect(isNotClosed(item({ resourceType: 'BOOKING_REQUEST', status: 'PENDING_DOCTOR' }), END + 1)).toBe(false);
      expect(presentCalendarItem(item()).notClosed).toBe(false);
      expect(isNotClosed(item({ end: 'not a date' }), END + 1)).toBe(false);
    });
  });
});
