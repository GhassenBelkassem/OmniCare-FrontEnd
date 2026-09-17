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
