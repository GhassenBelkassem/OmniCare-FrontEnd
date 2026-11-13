import { describe, expect, it } from 'vitest';

import type {
  AppointmentDto,
  AppointmentStatusDto,
  AvailabilityExceptionDto,
  AvailabilityRuleDto,
  UrgentOfferDto,
} from '../appointment-api.models';
import type { UrgentRequestSummaryDto } from '../doctor-urgent-api.service';
import {
  appointmentPatientLabel,
  appointmentStatusLabel,
  countAppointmentsOfDay,
  isFollowUpItem,
  projectAppointmentEvents,
  isUnplacedRequest,
  projectBreakEvents,
  projectRequestEvents,
  toRequestCalendarEvent,
  projectExceptionEvents,
  projectUrgentEvents,
  toUrgentCalendarEvent,
  toUrgentCalendarRecord,
  toAppointmentCalendarEvent,
  toScheduledAppointmentCalendarEvent,
} from './calendar-event.adapter';
import { at } from './calendar-time.testing';

function appointment(
  status: AppointmentStatusDto,
  overrides: Partial<AppointmentDto> = {},
): AppointmentDto {
  return {
    id: 'appointment-17',
    doctorId: 'doctor-1',
    patientId: 'patient-9',
    patientName: 'Ahmed Ben Ali',
    startTime: '2026-10-08T09:17:23.456+01:00',
    endTime: '2026-10-08T10:02:23.456+01:00',
    status,
    source: 'PATIENT_BOOKED',
    notes: null,
    quotedPriceTnd: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    version: 0,
    ...overrides,
  };
}

describe('calendar appointment event adapter', () => {
  it('projects a confirmed appointment as a foreground event', () => {
    expect(toAppointmentCalendarEvent(appointment('CONFIRMED'))).toMatchObject({
      allDay: false,
      className: expect.stringContaining('omnicare-appointment-event--confirmed'),
      extendedProps: { status: 'CONFIRMED', statusLabel: 'Confirmé' },
    });
  });

  it('projects an in-progress appointment with its presentation', () => {
    expect(toAppointmentCalendarEvent(appointment('IN_PROGRESS'))).toMatchObject({
      className: expect.stringContaining('omnicare-appointment-event--in-progress'),
      extendedProps: { status: 'IN_PROGRESS', statusLabel: 'En cours' },
    });
  });

  it('projects a completed appointment with subdued presentation metadata', () => {
    expect(toAppointmentCalendarEvent(appointment('COMPLETED'))).toMatchObject({
      className: expect.stringContaining('omnicare-appointment-event--completed'),
      extendedProps: { status: 'COMPLETED', statusLabel: 'Terminé' },
    });
  });

  it('filters cancelled appointments', () => {
    expect(toAppointmentCalendarEvent(appointment('CANCELLED'))).toBeNull();
  });

  it('preserves the current product behavior of filtering no-shows', () => {
    expect(toAppointmentCalendarEvent(appointment('NO_SHOW'))).toBeNull();
  });

  it('preserves the exact start instant string', () => {
    expect(toAppointmentCalendarEvent(appointment('CONFIRMED'))?.start).toBe(
      '2026-10-08T09:17:23.456+01:00',
    );
  });

  it('preserves the exact end instant string', () => {
    expect(toAppointmentCalendarEvent(appointment('CONFIRMED'))?.end).toBe(
      '2026-10-08T10:02:23.456+01:00',
    );
  });

  it('uses a stable prefixed event ID', () => {
    expect(toAppointmentCalendarEvent(appointment('CONFIRMED'))?.id).toBe(
      'appointment:appointment-17',
    );
  });

  it('uses the patient display name and the existing patient-ID fallback', () => {
    expect(appointmentPatientLabel(appointment('CONFIRMED'))).toBe('Ahmed Ben Ali');
    expect(appointmentPatientLabel(appointment('CONFIRMED', { patientName: '   ' }))).toBe(
      'patient-9',
    );
  });

  it('does not invent a Cabinet field', () => {
    const event = toAppointmentCalendarEvent(appointment('CONFIRMED'));
    expect(event).not.toHaveProperty('resourceId');
    expect(event?.extendedProps).not.toHaveProperty('cabinet');
    expect(event?.extendedProps).not.toHaveProperty('practiceLocationId');
  });

  it('emits only discriminated presentation metadata, not the raw DTO', () => {
    expect(toAppointmentCalendarEvent(appointment('CONFIRMED'))?.extendedProps).toEqual({
      kind: 'appointment',
      appointmentId: 'appointment-17',
      status: 'CONFIRMED',
      patientLabel: 'Ahmed Ben Ali',
      statusLabel: 'Confirmé',
    });
  });

  it('maps approved textual status labels', () => {
    expect(appointmentStatusLabel('CONFIRMED')).toBe('Confirmé');
    expect(appointmentStatusLabel('IN_PROGRESS')).toBe('En cours');
    expect(appointmentStatusLabel('COMPLETED')).toBe('Terminé');
  });

  it('filters terminal and unknown states from an event-array projection', () => {
    const events = projectAppointmentEvents([
      appointment('CONFIRMED', { id: 'visible' }),
      appointment('CANCELLED', { id: 'cancelled' }),
      appointment('NO_SHOW', { id: 'no-show' }),
      appointment('PENDING_SOMETHING' as AppointmentStatusDto, { id: 'not-a-real-status' }),
    ]);

    expect(events.map((event) => event.id)).toEqual(['appointment:visible']);
  });

  it('shows a follow-up proposed to an OmniCare patient as « Proposé » (G-1 D4)', () => {
    const [event] = projectAppointmentEvents([appointment('PROPOSED', { id: 'proposal', source: 'DOCTOR_FOLLOWUP' })]);
    expect(event?.id).toBe('appointment:proposal');
    expect(event?.extendedProps.statusLabel).toBe('Proposé');
    expect(event?.className).toContain('omnicare-appointment-event--proposed');
  });
});

function exception(
  type: 'BLOCK' | 'EXTRA',
  overrides: Partial<AvailabilityExceptionDto> = {},
): AvailabilityExceptionDto {
  return {
    id: 'exception-4',
    exceptionDate: '2031-04-08',
    type,
    startTime: '14:00',
    endTime: '16:00',
    reason: 'Formation',
    ...overrides,
  };
}

describe('calendar exception event adapter', () => {
  it('maps BLOCK to a non-interactive background event', () => {
    const [background] = projectExceptionEvents([exception('BLOCK')], 'week');
    expect(background).toMatchObject({
      id: 'exception:block:exception-4',
      display: 'background',
      interactive: false,
      extendedProps: { kind: 'block-exception', exceptionType: 'BLOCK' },
    });
  });

  it('retains BLOCK reason, type, and time in its interactive annotation', () => {
    const [, annotation] = projectExceptionEvents([exception('BLOCK')], 'day');
    expect(annotation).toMatchObject({
      id: 'exception-annotation:exception-4',
      interactive: true,
      extendedProps: {
        kind: 'exception-annotation',
        typeLabel: 'Indisponible',
        reason: 'Formation',
        timeLabel: '14:00–16:00',
      },
    });
  });

  it('does not project BLOCK as an appointment', () => {
    expect(projectExceptionEvents([exception('BLOCK')], 'week')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extendedProps: { kind: 'appointment' } })]),
    );
  });

  it('maps EXTRA to a distinct background event', () => {
    const [background] = projectExceptionEvents([exception('EXTRA')], 'week');
    expect(background).toMatchObject({
      id: 'exception:extra:exception-4',
      display: 'background',
      extendedProps: { kind: 'extra-exception', exceptionType: 'EXTRA' },
    });
  });

  it('maps EXTRA to a stable interactive annotation', () => {
    const [, annotation] = projectExceptionEvents([exception('EXTRA')], 'week');
    expect(annotation).toMatchObject({
      id: 'exception-annotation:exception-4',
      title: 'Ouverture exceptionnelle',
      extendedProps: { kind: 'exception-annotation' },
    });
  });

  it('creates no generated free-slot events', () => {
    expect(projectExceptionEvents([exception('EXTRA')], 'day')).toHaveLength(2);
    expect(projectExceptionEvents([exception('EXTRA')], 'day')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extendedProps: { kind: 'free-slot' } })]),
    );
  });

  it('keeps month free from exception interval noise', () => {
    expect(projectExceptionEvents([exception('BLOCK'), exception('EXTRA')], 'month')).toEqual([]);
  });

  it('combines exception date and wall clock without a timezone suffix', () => {
    const [background] = projectExceptionEvents([exception('BLOCK')], 'day');
    expect(background.start).toBe('2031-04-08T14:00:00');
    expect(background.end).toBe('2031-04-08T16:00:00');
  });
});

function urgentSummary(overrides: Partial<UrgentRequestSummaryDto> = {}): UrgentRequestSummaryDto {
  return {
    id: 'urgent-7',
    status: 'MATCHED',
    selectedOfferId: 'offer-7',
    matchedAt: '2031-04-08T14:20:00.000Z',
    arrivedAt: null,
    ...overrides,
  };
}

function urgentOffer(overrides: Partial<UrgentOfferDto> = {}): UrgentOfferDto {
  return {
    offerId: 'offer-7',
    requestId: 'urgent-7',
    doctorId: 'doctor-1',
    status: 'ACCEPTED',
    sentAt: '2031-04-08T14:00:00.000Z',
    respondedAt: '2031-04-08T14:05:00.000Z',
    patientName: 'Leïla Trabelsi',
    patientLatitude: 36.8,
    patientLongitude: 10.18,
    visitPreference: 'HOME_VISIT',
    notes: null,
    requestStatus: 'MATCHED',
    ...overrides,
  };
}

describe('calendar urgent event adapter', () => {
  it('projects a real matched urgent summary', () => {
    expect(toUrgentCalendarRecord(urgentSummary(), urgentOffer())).toEqual({
      requestId: 'urgent-7',
      patientLabel: 'Leïla Trabelsi',
      startInstant: '2031-04-08T14:20:00.000Z',
      arrivedAtInstant: null,
    });
  });

  it('uses a stable urgent ID and discriminated kind', () => {
    const record = toUrgentCalendarRecord(urgentSummary(), urgentOffer());
    expect(record && toUrgentCalendarEvent(record)).toMatchObject({
      id: 'urgent:urgent-7',
      interactive: false,
      extendedProps: { kind: 'urgent-estimate', requestId: 'urgent-7' },
    });
  });

  it('does not mix AppointmentDto semantics into urgent metadata', () => {
    const record = toUrgentCalendarRecord(urgentSummary(), urgentOffer());
    const metadata = record && toUrgentCalendarEvent(record)?.extendedProps;
    expect(metadata).not.toHaveProperty('appointmentId');
    expect(metadata).not.toHaveProperty('status');
  });

  it('uses matchedAt and the production 30-minute estimated duration', () => {
    const record = toUrgentCalendarRecord(urgentSummary(), urgentOffer());
    expect(record && toUrgentCalendarEvent(record)).toMatchObject({
      start: '2031-04-08T14:20:00.000Z',
      end: '2031-04-08T14:50:00.000Z',
      extendedProps: { estimatedMinutes: 30, statusLabel: 'Arrivée estimée' },
    });
  });

  it('uses arrivedAt as fallback anchor and exposes arrived status', () => {
    const record = toUrgentCalendarRecord(
      urgentSummary({ status: 'ARRIVED', matchedAt: null, arrivedAt: '2031-04-08T14:42:00.000Z' }),
      urgentOffer(),
    );
    expect(record && toUrgentCalendarEvent(record)).toMatchObject({
      start: '2031-04-08T14:42:00.000Z',
      className: 'omnicare-urgent-event--arrived',
      extendedProps: { arrivedAtInstant: '2031-04-08T14:42:00.000Z' },
    });
  });

  it.each(['CANCELLED', 'EXPIRED'] as const)('filters terminal status %s', (status) => {
    expect(toUrgentCalendarRecord(urgentSummary({ status }), urgentOffer())).toBeNull();
  });

  it('filters accepted-but-not-matched state without arrival', () => {
    expect(
      toUrgentCalendarRecord(
        urgentSummary({ status: 'OPEN' as UrgentRequestSummaryDto['status'], matchedAt: null }),
        urgentOffer(),
      ),
    ).toBeNull();
  });

  it('does not project HOME or CABINET because production Calendar does not show it', () => {
    const record = toUrgentCalendarRecord(urgentSummary(), urgentOffer());
    const event = record && toUrgentCalendarEvent(record);
    expect(event?.extendedProps).not.toHaveProperty('visitPreference');
    expect(event?.title).toBe('Leïla Trabelsi');
  });

  it('falls back to the existing generic patient label', () => {
    expect(toUrgentCalendarRecord(urgentSummary(), undefined)?.patientLabel).toBe('Patient urgent');
  });

  it('projects urgent records without generating slots', () => {
    const record = toUrgentCalendarRecord(urgentSummary(), urgentOffer());
    expect(projectUrgentEvents(record ? [record] : [])).toHaveLength(1);
    expect(projectUrgentEvents(record ? [record] : [])[0]?.extendedProps.kind).toBe(
      'urgent-estimate',
    );
  });
});

describe('toScheduledAppointmentCalendarEvent (Phase 3)', () => {
  const item = (status: string, start = '2026-11-12T09:00:00Z', subjectType = 'SELF') =>
    ({
      resourceType: 'APPOINTMENT',
      requestId: null,
      appointmentId: `apt-${status}`,
      sourceBookingRequestId: null,
      version: 0,
      status,
      doctor: { displayName: 'Dr Test', specialty: null },
      subject: { subjectType, displayName: 'Nour Mechergui', relationship: null },
      cabinet: { name: 'Cabinet Lac', address: null, city: null, governorate: null },
      start,
      end: '2026-11-12T09:20:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: null,
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
      sortAt: start,
      updatedAt: start,
    }) as never;
  const now = new Date('2026-11-10T08:00:00Z');

  it('uses the shared status colours and shows cancelled appointments struck through', () => {
    const cancelled = toScheduledAppointmentCalendarEvent(item('CANCELLED'), now);
    expect(cancelled?.extendedProps.statusLabel).toBe('Annulé');
    expect(cancelled?.extendedProps.struck).toBe(true);
    expect(cancelled?.extendedProps.statusColor).toBe('var(--oc-error)');
    const confirmed = toScheduledAppointmentCalendarEvent(item('CONFIRMED'), now);
    expect(confirmed?.extendedProps.statusColor).toBe('var(--oc-primary)');
    expect(confirmed?.extendedProps.cabinetLabel).toBe('Cabinet Lac');
  });

  it('marks an in-progress consultation from a previous day as not closed', () => {
    const stale = toScheduledAppointmentCalendarEvent(
      item('IN_PROGRESS', '2026-10-28T09:00:00Z'),
      now,
    );
    expect(stale?.extendedProps.statusLabel).toBe('En cours');
    expect(stale?.extendedProps.unclosed).toBe(true);
    const today = toScheduledAppointmentCalendarEvent(
      item('IN_PROGRESS', '2026-11-10T07:30:00Z'),
      now,
    );
    expect(today?.extendedProps.unclosed).toBe(false);
  });

  it('labels external patients by type', () => {
    const external = toScheduledAppointmentCalendarEvent(
      item('CONFIRMED', undefined, 'PRACTICE_PATIENT'),
      now,
    );
    expect(external?.extendedProps.typeLabel).toBe('Patient externe');
  });
});

describe('CAL-2 calendar presentation on scheduled appointment events', () => {
  const item = (status: string, subjectType = 'SELF') =>
    ({
      resourceType: 'APPOINTMENT',
      requestId: null,
      appointmentId: `apt-${status}`,
      sourceBookingRequestId: null,
      version: 0,
      status,
      doctor: { displayName: 'Dr Test', specialty: null },
      subject: { subjectType, displayName: 'Test Patient', relationship: null },
      cabinet: { name: 'Cabinet Test', address: null, city: null, governorate: null },
      start: '2031-04-08T09:00:00Z',
      end: '2031-04-08T09:20:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: null,
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
      sortAt: '2031-04-08T09:00:00Z',
      updatedAt: '2031-04-08T09:00:00Z',
    }) as never;
  const now = new Date('2031-04-01T08:00:00Z');

  const expected: ReadonlyArray<readonly [string, string, string, boolean]> = [
    ['PROPOSED', 'waitingPatient', 'En attente du patient', true],
    ['CONFIRMED', 'upcoming', 'À venir', false],
    ['IN_PROGRESS', 'inProgress', 'En cours', false],
    ['COMPLETED', 'done', 'Terminé', false],
    ['NO_SHOW', 'absent', 'Absent', false],
    ['CANCELLED', 'cancelled', 'Annulé', false],
  ];

  for (const [status, state, label, dashed] of expected) {
    it(`puts the CAL-1 state hook and label on a ${status} event`, () => {
      const event = toScheduledAppointmentCalendarEvent(item(status), now);

      expect(event?.className).toContain(`oc-cal-state--${state}`);
      expect(event?.extendedProps).toMatchObject({
        calendarState: state,
        stateLabel: label,
        dashed,
        cssClass: `oc-cal-state--${state}`,
      });
    });
  }

  it('treats an appointment as a normal one when the API sends no followUp', () => {
    const event = toScheduledAppointmentCalendarEvent(item('CONFIRMED'), now);

    expect(event?.extendedProps.calendarState).toBe('upcoming');
    expect(event?.className).not.toContain('followUp');
    expect(isFollowUpItem(item('CONFIRMED'))).toBe(false);
  });

  it('keeps the legacy status classes and shared status label next to the new state', () => {
    const event = toScheduledAppointmentCalendarEvent(item('CONFIRMED'), now);

    expect(event?.className).toContain('omnicare-appointment-event--confirmed');
    expect(event?.extendedProps.statusLabel).toBe('Confirmé');
  });

  it('uses the cabinet or external icon only', () => {
    const cabinet = toScheduledAppointmentCalendarEvent(item('CONFIRMED', 'SELF'), now);
    const external = toScheduledAppointmentCalendarEvent(item('CONFIRMED', 'PRACTICE_PATIENT'), now);

    expect(cabinet?.extendedProps).toMatchObject({ typeKind: 'cabinet', typeIcon: 'home' });
    expect(external?.extendedProps).toMatchObject({ typeKind: 'external', typeIcon: 'user-add' });
  });
});

describe('projectBreakEvents', () => {
  const rule = (overrides: Partial<AvailabilityRuleDto> = {}): AvailabilityRuleDto => ({
    dayOfWeek: 'MONDAY',
    active: true,
    startTime: '08:00',
    endTime: '17:00',
    pauseStart: '12:30',
    pauseEnd: '14:00',
    slotDurationMinutes: 30,
    ...overrides,
  });
  // Monday 7 April 2031 (local) to the following Monday, exclusive.
  const week = {
    startMs: at('2031-04-07').getTime(),
    endMs: at('2031-04-14').getTime(),
  };

  it('produces a non-interactive break block from the rule pause, as wall-clock times', () => {
    const [event, ...rest] = projectBreakEvents([rule()], week, 'week');

    expect(rest).toEqual([]);
    expect(event).toMatchObject({
      id: 'break:2031-04-07',
      title: 'Pause déjeuner',
      start: '2031-04-07T12:30:00',
      end: '2031-04-07T14:00:00',
      allDay: false,
      display: 'block',
      interactive: false,
      className: 'oc-cal-break',
      extendedProps: { kind: 'break', title: 'Pause déjeuner', timeLabel: '12:30 – 14:00' },
    });
  });

  it('produces one block per visible day that has a pause, using that weekday rule', () => {
    const events = projectBreakEvents(
      [
        rule(),
        rule({ dayOfWeek: 'WEDNESDAY', pauseStart: '13:00', pauseEnd: '14:00' }),
        rule({ dayOfWeek: 'THURSDAY', pauseStart: null, pauseEnd: null }),
      ],
      week,
      'week',
    );

    expect(events.map((event) => event.id)).toEqual(['break:2031-04-07', 'break:2031-04-09']);
    expect(events[1]?.extendedProps.timeLabel).toBe('13:00 – 14:00');
  });

  it('works for the day view and covers every day of a longer range', () => {
    const day = { startMs: at('2031-04-07').getTime(), endMs: at('2031-04-08').getTime() };
    const twoWeeks = { startMs: week.startMs, endMs: at('2031-04-21').getTime() };

    expect(projectBreakEvents([rule()], day, 'day')).toHaveLength(1);
    expect(projectBreakEvents([rule()], twoWeeks, 'week').map((event) => event.id)).toEqual([
      'break:2031-04-07',
      'break:2031-04-14',
    ]);
  });

  it('skips inactive rules and invalid or missing pauses', () => {
    expect(projectBreakEvents([rule({ active: false })], week, 'week')).toEqual([]);
    expect(projectBreakEvents([rule({ pauseStart: null })], week, 'week')).toEqual([]);
    expect(projectBreakEvents([rule({ pauseEnd: null })], week, 'week')).toEqual([]);
    // Pause outside the working window.
    expect(
      projectBreakEvents([rule({ pauseStart: '07:00', pauseEnd: '08:30' })], week, 'week'),
    ).toEqual([]);
    // Pause that ends before it starts.
    expect(
      projectBreakEvents([rule({ pauseStart: '14:00', pauseEnd: '12:30' })], week, 'week'),
    ).toEqual([]);
  });

  it('is empty in month view, without rules and before any range is known', () => {
    expect(projectBreakEvents([rule()], week, 'month')).toEqual([]);
    expect(projectBreakEvents([], week, 'week')).toEqual([]);
    expect(projectBreakEvents([rule()], null, 'week')).toEqual([]);
  });

  it('keeps HH:mm labels when the API sends seconds', () => {
    const [event] = projectBreakEvents(
      [rule({ pauseStart: '12:30:00', pauseEnd: '14:00:00' })],
      week,
      'week',
    );

    expect(event?.start).toBe('2031-04-07T12:30:00');
    expect(event?.extendedProps.timeLabel).toBe('12:30 – 14:00');
  });
});

describe('CAL-3 booking requests on the grid', () => {
  const request = (status: string, overrides: Record<string, unknown> = {}) =>
    ({
      resourceType: 'BOOKING_REQUEST',
      requestId: `req-${status}`,
      appointmentId: null,
      sourceBookingRequestId: null,
      version: 1,
      status,
      doctor: { displayName: 'Dr Test', specialty: null },
      subject: { subjectType: 'SELF', displayName: 'Test Patient', relationship: null },
      cabinet: { name: 'Cabinet Test', address: null, city: null, governorate: null },
      start: '2031-04-08T09:00:00Z',
      end: '2031-04-08T09:30:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: '2031-04-07T09:00:00Z',
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
      sortAt: '2031-04-08T09:00:00Z',
      updatedAt: '2031-04-08T09:00:00Z',
      ...overrides,
    }) as never;

  it('draws a request waiting for the doctor as « Demande » (dashed, amber state)', () => {
    const event = toRequestCalendarEvent(request('PENDING_DOCTOR'));

    expect(event).toMatchObject({
      id: 'request:req-PENDING_DOCTOR',
      start: '2031-04-08T09:00:00Z',
      end: '2031-04-08T09:30:00Z',
      interactive: true,
      className: expect.stringContaining('oc-cal-state--request'),
      extendedProps: {
        kind: 'request',
        requestId: 'req-PENDING_DOCTOR',
        requestStatus: 'PENDING_DOCTOR',
        calendarState: 'request',
        stateLabel: 'Demande',
        dashed: true,
        cssClass: 'oc-cal-state--request',
        patientLabel: 'Test Patient',
      },
    });
  });

  it('draws a request waiting for the patient as « En attente du patient » (dashed, blue state)', () => {
    const event = toRequestCalendarEvent(request('PENDING_PATIENT_TIME_CONFIRMATION'));

    expect(event?.extendedProps).toMatchObject({
      calendarState: 'waitingPatient',
      stateLabel: 'En attente du patient',
      dashed: true,
      cssClass: 'oc-cal-state--waitingPatient',
    });
  });

  it('draws a proposed appointment as « En attente du patient » too', () => {
    const event = toScheduledAppointmentCalendarEvent(
      {
        ...(request('PENDING_DOCTOR') as object),
        resourceType: 'APPOINTMENT',
        requestId: null,
        appointmentId: 'apt-proposed',
        status: 'PROPOSED',
      } as never,
      new Date('2031-04-01T08:00:00Z'),
    );

    expect(event?.extendedProps).toMatchObject({
      calendarState: 'waitingPatient',
      stateLabel: 'En attente du patient',
      dashed: true,
    });
  });

  it('does not draw closed requests', () => {
    for (const status of ['FULFILLED', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'EXPIRED']) {
      expect(toRequestCalendarEvent(request(status))).toBeNull();
    }
  });

  it('does not draw a request without an exact time, and counts it as unplaced', () => {
    const noEnd = request('PENDING_DOCTOR', { end: null });
    const reversed = request('PENDING_DOCTOR', { start: '2031-04-08T10:00:00Z' });
    const garbage = request('PENDING_DOCTOR', { start: 'soon', end: 'later' });

    for (const item of [noEnd, reversed, garbage]) {
      expect(toRequestCalendarEvent(item)).toBeNull();
      expect(isUnplacedRequest(item)).toBe(true);
    }
    expect(isUnplacedRequest(request('PENDING_DOCTOR'))).toBe(false);
    expect(isUnplacedRequest(request('EXPIRED', { end: null }))).toBe(false);
    expect(projectRequestEvents([noEnd, request('PENDING_DOCTOR'), garbage])).toHaveLength(1);
  });

  it('ignores appointments and requests without an identity', () => {
    expect(
      toRequestCalendarEvent(request('PENDING_DOCTOR', { resourceType: 'APPOINTMENT' })),
    ).toBeNull();
    expect(toRequestCalendarEvent(request('PENDING_DOCTOR', { requestId: null }))).toBeNull();
  });

  it('uses the external icon for a practice patient request', () => {
    const event = toRequestCalendarEvent(
      request('PENDING_DOCTOR', {
        subject: { subjectType: 'PRACTICE_PATIENT', displayName: 'Test Patient', relationship: null },
      }),
    );

    expect(event?.extendedProps).toMatchObject({ typeKind: 'external', typeIcon: 'user-add' });
  });
});

describe('CAL-3 follow-up appointments', () => {
  const item = (status: string, followUp?: unknown) =>
    ({
      resourceType: 'APPOINTMENT',
      requestId: null,
      appointmentId: `apt-${status}`,
      sourceBookingRequestId: null,
      version: 0,
      status,
      doctor: { displayName: 'Dr Test', specialty: null },
      subject: { subjectType: 'SELF', displayName: 'Test Patient', relationship: null },
      cabinet: { name: 'Cabinet Test', address: null, city: null, governorate: null },
      start: '2031-04-08T09:00:00Z',
      end: '2031-04-08T09:20:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: null,
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
      sortAt: '2031-04-08T09:00:00Z',
      updatedAt: '2031-04-08T09:00:00Z',
      ...(followUp === undefined ? {} : { followUp }),
    }) as never;
  const now = new Date('2031-04-01T08:00:00Z');

  it('turns a confirmed follow-up into « Suivi à venir »', () => {
    const event = toScheduledAppointmentCalendarEvent(item('CONFIRMED', true), now);

    expect(event?.className).toContain('oc-cal-state--followUpUpcoming');
    expect(event?.extendedProps).toMatchObject({
      calendarState: 'followUpUpcoming',
      stateLabel: 'Suivi à venir',
      dashed: false,
    });
  });

  it('turns a completed follow-up into « Suivi terminé »', () => {
    const event = toScheduledAppointmentCalendarEvent(item('COMPLETED', true), now);

    expect(event?.className).toContain('oc-cal-state--followUpDone');
    expect(event?.extendedProps).toMatchObject({
      calendarState: 'followUpDone',
      stateLabel: 'Suivi terminé',
    });
  });

  it('leaves in-progress, absent and cancelled appointments unchanged when they are follow-ups', () => {
    const expected: ReadonlyArray<readonly [string, string, string]> = [
      ['IN_PROGRESS', 'inProgress', 'En cours'],
      ['NO_SHOW', 'absent', 'Absent'],
      ['CANCELLED', 'cancelled', 'Annulé'],
    ];
    for (const [status, state, label] of expected) {
      for (const followUp of [true, false, undefined]) {
        const event = toScheduledAppointmentCalendarEvent(item(status, followUp), now);
        expect(event?.extendedProps).toMatchObject({ calendarState: state, stateLabel: label });
      }
    }
  });

  it('treats a missing, false or non-boolean followUp as a normal appointment, without crashing', () => {
    for (const followUp of [undefined, false, null, 'true', 1, {}]) {
      const confirmed = toScheduledAppointmentCalendarEvent(item('CONFIRMED', followUp), now);
      const completed = toScheduledAppointmentCalendarEvent(item('COMPLETED', followUp), now);
      expect(confirmed?.extendedProps.calendarState).toBe('upcoming');
      expect(completed?.extendedProps.calendarState).toBe('done');
      expect(isFollowUpItem(item('CONFIRMED', followUp))).toBe(false);
    }
    expect(isFollowUpItem(item('CONFIRMED', true))).toBe(true);
  });
});

describe('projectBreakEvents in Africa/Tunis', () => {
  const pause = (dayOfWeek: AvailabilityRuleDto['dayOfWeek']): AvailabilityRuleDto => ({
    dayOfWeek,
    active: true,
    startTime: '08:00',
    endTime: '17:00',
    pauseStart: '12:30',
    pauseEnd: '14:00',
    slotDurationMinutes: 30,
  });

  it('starts at the first Tunis day of the range, even when it is still the day before in UTC', () => {
    // Monday 16 Nov 00:00 Tunis = Sunday 15 Nov 23:00 UTC.
    const week = {
      startMs: Date.parse('2026-11-15T23:00:00.000Z'),
      endMs: Date.parse('2026-11-22T23:00:00.000Z'),
    };

    const ids = projectBreakEvents([pause('MONDAY'), pause('SUNDAY')], week, 'week').map((event) => event.id);

    expect(ids).toEqual(['break:2026-11-16', 'break:2026-11-22']);
  });

  it('gives a one-day range exactly one Tunis day', () => {
    const day = {
      startMs: Date.parse('2026-11-15T23:00:00.000Z'),
      endMs: Date.parse('2026-11-16T23:00:00.000Z'),
    };

    expect(projectBreakEvents([pause('MONDAY'), pause('SUNDAY')], day, 'day').map((event) => event.id)).toEqual([
      'break:2026-11-16',
    ]);
  });
});

describe('scheduled events in Africa/Tunis', () => {
  it('flags a consultation started before today in Tunis, not in UTC', () => {
    const item = (start: string) =>
      ({
        resourceType: 'APPOINTMENT', requestId: null, appointmentId: 'a', sourceBookingRequestId: null,
        version: 0, status: 'IN_PROGRESS', doctor: { displayName: 'Dr Test', specialty: null },
        subject: { subjectType: 'SELF', displayName: 'Test Patient', relationship: null },
        cabinet: { name: 'Cabinet', address: null, city: null, governorate: null },
        start, end: start, timezone: 'Africa/Tunis', responseDeadline: null, cancellation: null,
        intakeStatus: null, availableActions: [], sortAt: start, updatedAt: start,
      }) as never;
    // « now » = Monday 16 Nov 00:30 Tunis (Sunday 23:30 UTC).
    const now = new Date('2026-11-15T23:30:00.000Z');

    // Started Sunday 23:45 Tunis (22:45 UTC): yesterday in Tunis, so not closed properly.
    expect(
      toScheduledAppointmentCalendarEvent(item('2026-11-15T22:45:00.000Z'), now)?.extendedProps.unclosed,
    ).toBe(true);
    // Started Monday 00:10 Tunis (Sunday 23:10 UTC): today in Tunis, even though the UTC day is yesterday.
    expect(
      toScheduledAppointmentCalendarEvent(item('2026-11-15T23:10:00.000Z'), now)?.extendedProps.unclosed,
    ).toBe(false);
  });
});

describe('countAppointmentsOfDay', () => {
  const row = (id: string, status: string, start: string, resourceType = 'APPOINTMENT') =>
    ({ resourceType, appointmentId: id, status, start, end: start }) as never;

  it('counts the appointments of one Tunis day, without the cancelled ones', () => {
    const items = [
      row('a', 'CONFIRMED', '2026-11-16T08:00:00.000Z'),
      row('b', 'COMPLETED', '2026-11-16T09:00:00.000Z'),
      row('c', 'NO_SHOW', '2026-11-16T10:00:00.000Z'),
      row('d', 'PROPOSED', '2026-11-16T11:00:00.000Z'),
      row('e', 'CANCELLED', '2026-11-16T12:00:00.000Z'),
      row('f', 'CONFIRMED', '2026-11-17T08:00:00.000Z'),
      row('g', 'CONFIRMED', '2026-11-15T08:00:00.000Z'),
    ];

    expect(countAppointmentsOfDay(items, '2026-11-16')).toBe(4);
    expect(countAppointmentsOfDay(items, '2026-11-17')).toBe(1);
    expect(countAppointmentsOfDay(items, '2026-11-18')).toBe(0);
  });

  it('reads the day in Tunis, at the midnight boundaries', () => {
    const items = [
      row('before', 'CONFIRMED', '2026-11-15T22:59:59.999Z'), // Sunday 23:59:59 Tunis
      row('first', 'CONFIRMED', '2026-11-15T23:00:00.000Z'), // Monday 00:00 Tunis
      row('last', 'CONFIRMED', '2026-11-16T22:59:59.999Z'), // Monday 23:59:59 Tunis
      row('after', 'CONFIRMED', '2026-11-16T23:00:00.000Z'), // Tuesday 00:00 Tunis
    ];

    expect(countAppointmentsOfDay(items, '2026-11-16')).toBe(2);
  });

  it('ignores booking requests and an unknown day', () => {
    const items = [row('r', 'PENDING_DOCTOR', '2026-11-16T08:00:00.000Z', 'BOOKING_REQUEST')];

    expect(countAppointmentsOfDay(items, '2026-11-16')).toBe(0);
    expect(countAppointmentsOfDay([row('a', 'CONFIRMED', '2026-11-16T08:00:00.000Z')], '')).toBe(0);
  });
});

describe('CAL-FIX fix 5: past confirmed appointments on the week grid', () => {
  const item = (status: string, followUp = false) =>
    ({
      resourceType: 'APPOINTMENT',
      requestId: null,
      appointmentId: `apt-${status}`,
      sourceBookingRequestId: null,
      version: 0,
      status,
      doctor: { displayName: 'Dr Test', specialty: null },
      subject: { subjectType: 'SELF', displayName: 'Test Patient', relationship: null },
      cabinet: { name: 'Cabinet Test', address: null, city: null, governorate: null },
      start: '2031-04-08T09:00:00Z',
      end: '2031-04-08T09:30:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: null,
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
      sortAt: '2031-04-08T09:00:00Z',
      updatedAt: '2031-04-08T09:00:00Z',
      followUp,
    }) as never;

  it('draws a muted card with « Non clôturé » once the end is past (never « À venir »)', () => {
    const event = toScheduledAppointmentCalendarEvent(item('CONFIRMED'), new Date('2031-04-08T10:00:00Z'));
    expect(event?.extendedProps).toMatchObject({ stateLabel: 'Non clôturé', notClosed: true, muted: true, calendarState: 'upcoming' });
    expect(event?.className).toContain('oc-calendar-event--muted');
    expect(event?.className).toContain('oc-cal-state--not-closed');
    const follow = toScheduledAppointmentCalendarEvent(item('CONFIRMED', true), new Date('2031-04-08T10:00:00Z'));
    expect(follow?.extendedProps.stateLabel).toBe('Non clôturé');
  });

  it('keeps « À venir » before the end and leaves completed or started appointments alone', () => {
    expect(toScheduledAppointmentCalendarEvent(item('CONFIRMED'), new Date('2031-04-08T09:10:00Z'))?.extendedProps)
      .toMatchObject({ stateLabel: 'À venir', notClosed: false });
    expect(toScheduledAppointmentCalendarEvent(item('COMPLETED'), new Date('2031-04-09T10:00:00Z'))?.extendedProps.stateLabel)
      .toBe('Terminé');
    expect(toScheduledAppointmentCalendarEvent(item('IN_PROGRESS'), new Date('2031-04-08T10:00:00Z'))?.extendedProps.notClosed)
      .toBe(false);
  });

  it('fix 11: reads the typed followUp field (true only)', () => {
    expect(isFollowUpItem(item('CONFIRMED', true))).toBe(true);
    expect(isFollowUpItem(item('CONFIRMED', false))).toBe(false);
  });
});

