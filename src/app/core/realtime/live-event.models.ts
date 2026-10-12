/**
 * Verified against OmniCare-BackEnd LiveEventEnvelope / LiveEventService.
 * Field names are exact: "event", "data", "timestamp" (Jackson camelCase defaults).
 */
export interface LiveEventEnvelope<T extends object> {
  readonly event: string;
  readonly data: T;
  readonly timestamp: string;
}

export const URGENT_REQUESTS_QUEUE = '/user/queue/urgent-requests';
export const APPOINTMENTS_QUEUE = '/user/queue/appointments';
export const SCHEDULED_CARE_QUEUE = '/user/queue/scheduled-care';
export const NOTIFICATIONS_QUEUE = '/user/queue/notifications';

export interface NotificationInvalidation {
  readonly eventType: 'NOTIFICATION_CREATED';
  readonly notificationId: string;
  readonly occurredAt: string;
}

export function isNotificationInvalidation(value: unknown): value is NotificationInvalidation {
  if (value === null || typeof value !== 'object') return false;
  const event = value as Partial<NotificationInvalidation>;
  return event.eventType === 'NOTIFICATION_CREATED' &&
    typeof event.notificationId === 'string' && event.notificationId.length > 0 &&
    typeof event.occurredAt === 'string';
}

export interface ScheduledCareEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly resourceType: 'BOOKING_REQUEST' | 'APPOINTMENT';
  readonly resourceId: string;
  readonly version: number;
  readonly occurredAt: string;
}

export function isScheduledCareEvent(value: unknown): value is ScheduledCareEvent {
  if (value === null || typeof value !== 'object') return false;
  const event = value as Partial<ScheduledCareEvent>;
  return (
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    (event.resourceType === 'BOOKING_REQUEST' || event.resourceType === 'APPOINTMENT') &&
    typeof event.resourceId === 'string' &&
    typeof event.version === 'number' &&
    typeof event.occurredAt === 'string'
  );
}

export type UrgentLiveEventName =
  | 'NEW_OFFER'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'REQUEST_MATCHED'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_CANCELLED'
  | 'DOCTOR_ARRIVED'
  | 'DOCTOR_LOCATION_UPDATE';

export type AppointmentLiveEventName =
  | 'BOOKING_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_STARTED'
  | 'APPOINTMENT_COMPLETED';

export interface NewOfferData {
  readonly requestId: string;
  readonly patientName: string;
}

export interface OfferAcceptedData {
  readonly requestId: string;
  readonly doctorId: string;
  readonly doctorName: string;
}

export interface OfferDeclinedData {
  readonly requestId: string;
  readonly doctorId: string;
}

export interface RequestMatchedData {
  readonly requestId: string;
  readonly doctorId: string;
}

export interface RequestIdData {
  readonly requestId: string;
}

export interface DoctorArrivedData {
  readonly requestId: string;
  readonly doctorName: string;
}

export interface DoctorLocationUpdateData {
  readonly requestId: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface BookingConfirmedData {
  readonly appointmentId: string;
  readonly patientId: string;
}

export interface AppointmentIdData {
  readonly appointmentId: string;
}

export interface UrgentLiveEvent {
  readonly name: UrgentLiveEventName;
  readonly data:
    | NewOfferData
    | OfferAcceptedData
    | OfferDeclinedData
    | RequestMatchedData
    | RequestIdData
    | DoctorArrivedData
    | DoctorLocationUpdateData;
  readonly timestamp: string;
}

export interface AppointmentLiveEvent {
  readonly name: AppointmentLiveEventName;
  readonly data: BookingConfirmedData | AppointmentIdData;
  readonly timestamp: string;
}
