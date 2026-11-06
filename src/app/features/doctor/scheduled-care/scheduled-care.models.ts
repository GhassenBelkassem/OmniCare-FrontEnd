export type BookingRequestStatus =
  | 'PENDING_DOCTOR'
  | 'PENDING_PATIENT_TIME_CONFIRMATION'
  | 'FULFILLED'
  | 'CANCELLED_BY_PATIENT'
  | 'CANCELLED_BY_DOCTOR'
  | 'EXPIRED';

export type AppointmentStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type ScheduledCareResourceType = 'BOOKING_REQUEST' | 'APPOINTMENT';

export type ScheduledCareAction =
  'ACCEPT_REQUEST' | 'PROPOSE_NEW_TIME' | 'DECLINE_REQUEST' | 'CANCEL_APPOINTMENT';

export type DoctorReasonCode = 'CABINET_UNAVAILABLE' | 'DOCTOR_UNAVAILABLE' | 'SCHEDULE_CONFLICT';

export interface CareSubject {
  readonly subjectType: string;
  readonly familyMemberId: string | null;
  readonly displayName: string;
  readonly relationship: string | null;
}

export interface DoctorSummary {
  readonly doctorId?: string;
  readonly displayName: string;
  readonly specialty: string | null;
}

export interface CabinetSnapshot {
  readonly practiceLocationId?: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly governorate: string;
  readonly timezone: string;
}

export interface SlotRange {
  readonly start: string;
  readonly end: string;
}

export interface BookingProposal extends SlotRange {
  readonly proposalId: string;
  readonly proposedAt: string;
  readonly patientResponseDeadline: string;
}

export interface ActiveSlot extends SlotRange {
  readonly durationMinutes: number;
}

export interface CancellationSummary {
  readonly actor: string;
  readonly reasonCode: string;
  readonly cancelledAt: string;
  readonly lateCancellation?: boolean | null;
}

export interface BookingRequest {
  readonly requestId: string;
  readonly version: number;
  readonly status: BookingRequestStatus;
  readonly subject: CareSubject;
  readonly cabinet: CabinetSnapshot & { readonly practiceLocationId: string };
  readonly originalRequestedSlot: SlotRange;
  readonly proposedSlot: BookingProposal | null;
  readonly activeSlot: ActiveSlot;
  readonly createdAt: string;
  readonly responseDeadline: string;
  readonly patientResponseDeadline: string | null;
  readonly confirmedAppointmentId: string | null;
  readonly cancellation: CancellationSummary | null;
  readonly expiredAt: string | null;
  readonly expiryReason: string | null;
  readonly slotReleased: boolean;
  readonly availableActions: readonly ScheduledCareAction[];
  readonly updatedAt: string;
}

export interface QuotedPrice {
  readonly amount: number;
  readonly currency: string;
  readonly quotedAt: string;
}

export interface AppointmentPracticePatient {
  readonly practicePatientId: string;
  readonly dateOfBirth: string;
  readonly sex: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
}

export interface Appointment {
  readonly appointmentId: string;
  readonly sourceBookingRequestId: string;
  readonly version: number;
  readonly status: AppointmentStatus;
  readonly doctor: DoctorSummary & { readonly doctorId: string };
  readonly subject: CareSubject;
  readonly cabinet: CabinetSnapshot & { readonly practiceLocationId: string };
  readonly slot: ActiveSlot & { readonly timezone: string };
  readonly quotedPrice: QuotedPrice | null;
  readonly confirmedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancellation: CancellationSummary | null;
  readonly intakeStatus: string | null;
  readonly availableActions: readonly ScheduledCareAction[];
  readonly practicePatient?: AppointmentPracticePatient | null;
  readonly consultationReason?: string | null;
}

export interface DoctorScheduledCareItem {
  readonly resourceType: ScheduledCareResourceType;
  readonly requestId: string | null;
  readonly appointmentId: string | null;
  readonly sourceBookingRequestId: string | null;
  readonly version: number;
  readonly status: string;
  readonly doctor: DoctorSummary;
  readonly subject: Omit<CareSubject, 'familyMemberId'>;
  readonly cabinet: CabinetSnapshot;
  readonly start: string;
  readonly end: string;
  readonly timezone: string;
  readonly responseDeadline: string | null;
  readonly cancellation: CancellationSummary | null;
  readonly intakeStatus: string | null;
  readonly availableActions: readonly ScheduledCareAction[];
  readonly sortAt: string;
  readonly updatedAt: string;
}

export interface DoctorScheduledCareAgenda {
  readonly generatedAt: string;
  readonly from: string;
  readonly to: string;
  readonly items: readonly DoctorScheduledCareItem[];
}

export interface DoctorHomeSummary {
  readonly generatedAt: string;
  readonly pendingRequestCount: number;
  readonly nextPendingRequest: DoctorScheduledCareItem | null;
  readonly nextConfirmedAppointment: DoctorScheduledCareItem | null;
}

export interface AvailabilitySlot extends SlotRange {
  readonly durationMinutes: number;
}

export interface AvailabilityResponse {
  readonly doctorId: string;
  readonly practiceLocationId: string;
  readonly timezone: string;
  readonly generatedAt: string;
  readonly slots: readonly AvailabilitySlot[];
}

export interface DoctorBookingAcceptResponse {
  readonly request: BookingRequest;
  readonly appointment: Appointment;
}

export interface ProblemDetail {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly timestamp?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export interface ProposeBookingTimeRequest {
  readonly expectedVersion: number;
  readonly practiceLocationId: string;
  readonly proposedSlot: SlotRange;
}

export type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
