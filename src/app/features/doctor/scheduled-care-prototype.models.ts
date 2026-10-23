/**
 * P2-02 presentation-only models for the scheduled-care product freeze.
 *
 * These types are deliberately feature-local and MUST NOT be reused as wire
 * DTOs. The backend appointment contract remains unchanged in P2-02.
 */
export type ScheduledCareStatus =
  | 'PENDING_DOCTOR'
  | 'PENDING_PATIENT_TIME_CONFIRMATION'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED_BY_PATIENT'
  | 'CANCELLED_BY_DOCTOR';

export interface CabinetPrototype {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
}

export interface PatientSubjectPrototype {
  readonly type: 'SELF' | 'FAMILY_MEMBER';
  readonly familyMemberId: string | null;
  readonly displayName: string;
  readonly relationshipLabel: string;
}

export interface SlotPrototype {
  readonly id: string;
  readonly cabinetId: string;
  readonly start: string;
  readonly end: string;
}

export type IntakeStatusPrototype = 'NOT_SUBMITTED' | 'SUBMITTED';

export interface IntakePrototype {
  readonly status: IntakeStatusPrototype;
  readonly bodyAreas: readonly string[];
  readonly description: string | null;
  readonly painIntensity: number | null;
  readonly submittedAt: string | null;
}

interface ScheduledCareBasePrototype {
  readonly id: string;
  readonly patient: PatientSubjectPrototype;
  readonly doctorName: string;
  readonly doctorSpecialty: string;
  readonly cabinet: CabinetPrototype;
  readonly requestedSlot: SlotPrototype;
  readonly proposedSlot: SlotPrototype | null;
  readonly createdAt: string;
  readonly responseDeadline: string;
  readonly patientResponseDeadline: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly lateCancellation: boolean;
  readonly intake: IntakePrototype;
}

export interface BookingRequestPrototype extends ScheduledCareBasePrototype {
  readonly kind: 'BOOKING_REQUEST';
  readonly status: Exclude<ScheduledCareStatus, 'CONFIRMED'>;
}

export interface AppointmentPrototype extends ScheduledCareBasePrototype {
  readonly kind: 'APPOINTMENT';
  readonly status: 'CONFIRMED';
  readonly confirmedAt: string;
}

export type ScheduledCareRecordPrototype = BookingRequestPrototype | AppointmentPrototype;

export function activeSlot(record: ScheduledCareRecordPrototype): SlotPrototype {
  return record.proposedSlot ?? record.requestedSlot;
}

export function scheduledCareStatusLabel(status: ScheduledCareStatus): string {
  switch (status) {
    case 'PENDING_DOCTOR':
      return 'À confirmer par le médecin';
    case 'PENDING_PATIENT_TIME_CONFIRMATION':
      return 'Proposé au patient';
    case 'CONFIRMED':
      return 'Confirmé';
    case 'EXPIRED':
      return 'Expiré';
    case 'CANCELLED_BY_PATIENT':
      return 'Annulé par le patient';
    case 'CANCELLED_BY_DOCTOR':
      return 'Annulé par le médecin';
  }
}
