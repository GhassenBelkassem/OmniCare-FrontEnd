import { describe, expect, it } from 'vitest';

import type {
  AppointmentDto,
  AppointmentStatusDto,
  AvailabilityExceptionDto,
  UrgentOfferDto,
} from '../appointment-api.models';
import type { UrgentRequestSummaryDto } from '../doctor-urgent-api.service';
import {
  appointmentPatientLabel,
  appointmentStatusLabel,
  projectAppointmentEvents,
  projectExceptionEvents,
  projectUrgentEvents,
  toUrgentCalendarEvent,
  toUrgentCalendarRecord,
  toAppointmentCalendarEvent,
  toScheduledAppointmentCalendarEvent,
} from './calendar-event.adapter';

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
      appointment('PROPOSED' as AppointmentStatusDto, { id: 'not-a-real-status' }),
    ]);

    expect(events.map((event) => event.id)).toEqual(['appointment:visible']);
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
