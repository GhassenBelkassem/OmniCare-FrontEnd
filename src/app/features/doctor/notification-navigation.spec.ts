import type { NotificationItemDto } from './appointment-api.models';
import { notificationTarget } from './doctor-shell';

function item(type: string, payload: NotificationItemDto['deepLinkPayload']): NotificationItemDto {
  return {
    id: 'notification-1',
    type,
    priority: 'HIGH',
    category: 'APPOINTMENT',
    titleFr: 'Titre',
    bodyFr: 'Corps',
    titleAr: '',
    bodyAr: '',
    deepLinkPayload: payload,
    read: false,
    createdAt: '2026-10-09T10:00:00Z',
  };
}

describe('notificationTarget', () => {
  it('routes created requests by request_id', () => expectRequest('DOCTOR_BOOKING_REQUEST_CREATED'));
  it('routes proposed times by request_id', () => expectRequest('DOCTOR_BOOKING_TIME_PROPOSED'));
  it('routes doctor declines by request_id', () => expectRequest('DOCTOR_BOOKING_REQUEST_DECLINED'));
  it('routes patient request cancellations by request_id', () => expectRequest('DOCTOR_BOOKING_REQUEST_CANCELLED_BY_PATIENT'));
  it('routes proposal declines by request_id', () => expectRequest('DOCTOR_BOOKING_PROPOSAL_DECLINED'));
  it('routes request expiry by request_id', () => expectRequest('DOCTOR_BOOKING_REQUEST_EXPIRED'));
  it('routes proposal acceptance by appointment_id', () => expectAppointment('DOCTOR_BOOKING_PROPOSAL_ACCEPTED'));
  it('routes appointment confirmation by appointment_id', () => expectAppointment('APPOINTMENT_CONFIRMED'));
  it('routes patient appointment cancellation by appointment_id', () => expectAppointment('APPOINTMENT_CANCELLED_BY_PATIENT'));
  it('routes professional appointment cancellation by appointment_id', () => expectAppointment('APPOINTMENT_CANCELLED_BY_PROFESSIONAL'));

  it('does not route an unknown type even when ids exist', () => {
    expect(notificationTarget(item('UNKNOWN', { request_id: 'r-1', appointment_id: 'a-1' }))).toBeNull();
  });

  it('does not route request types without request_id', () => {
    expect(notificationTarget(item('DOCTOR_BOOKING_REQUEST_CREATED', { appointment_id: 'a-1' }))).toBeNull();
  });

  it('does not route appointment types without appointment_id', () => {
    expect(notificationTarget(item('APPOINTMENT_CONFIRMED', { request_id: 'r-1' }))).toBeNull();
  });

  it('does not route null payloads', () => {
    expect(notificationTarget(item('APPOINTMENT_CONFIRMED', null))).toBeNull();
  });
});

function expectRequest(type: string): void {
  expect(notificationTarget(item(type, { request_id: 'request-1' }))).toEqual({
    kind: 'request',
    id: 'request-1',
  });
}

function expectAppointment(type: string): void {
  expect(notificationTarget(item(type, { appointment_id: 'appointment-1' }))).toEqual({
    kind: 'appointment',
    id: 'appointment-1',
  });
}
