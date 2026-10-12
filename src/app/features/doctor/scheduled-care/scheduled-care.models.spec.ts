import { isScheduledCareEvent } from '../../../core/realtime/live-event.models';
import type {
  AppointmentStatus,
  BookingRequestStatus,
  DoctorHomeSummary,
  DoctorScheduledCareItem,
} from './scheduled-care.models';

describe('scheduled-care contract models', () => {
  it('retains every frozen request and appointment state', () => {
    const requests: readonly BookingRequestStatus[] = [
      'PENDING_DOCTOR',
      'PENDING_PATIENT_TIME_CONFIRMATION',
      'FULFILLED',
      'CANCELLED_BY_PATIENT',
      'CANCELLED_BY_DOCTOR',
      'EXPIRED',
    ];
    const appointments: readonly AppointmentStatus[] = [
      'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED', 'NO_SHOW',
    ];
    expect(requests).toHaveLength(6);
    expect(appointments).toHaveLength(5);
  });

  it('keeps the agenda discriminant and home resources explicit', () => {
    const request = { resourceType: 'BOOKING_REQUEST', requestId: 'request-1', appointmentId: null } as DoctorScheduledCareItem;
    const appointment = { resourceType: 'APPOINTMENT', requestId: null, appointmentId: 'appointment-1' } as DoctorScheduledCareItem;
    const home: DoctorHomeSummary = {
      generatedAt: '2026-10-08T10:00:00Z',
      pendingRequestCount: 1,
      nextPendingRequest: request,
      nextConfirmedAppointment: appointment,
    };
    expect(home.nextPendingRequest?.requestId).toBe('request-1');
    expect(home.nextConfirmedAppointment?.appointmentId).toBe('appointment-1');
  });

  it('validates the PII-free realtime envelope and rejects unknown resource types', () => {
    expect(isScheduledCareEvent({
      eventId: 'event-1',
      eventType: 'REQUEST_ACCEPTED',
      resourceType: 'BOOKING_REQUEST',
      resourceId: 'request-1',
      version: 2,
      occurredAt: '2026-10-08T10:00:00Z',
    })).toBe(true);
    expect(isScheduledCareEvent({
      eventId: 'event-2', eventType: 'X', resourceType: 'PATIENT', resourceId: 'patient-1', version: 1, occurredAt: '',
    })).toBe(false);
  });
});
