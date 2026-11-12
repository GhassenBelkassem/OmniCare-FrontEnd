export type ConsultationSourceType = 'SCHEDULED_APPOINTMENT' | 'URGENT_HOME' | 'URGENT_CABINET';

export type ConsultationStatus = 'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | 'ABORTED';

export type MedicalAccessStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'UNAVAILABLE';

/** Server-computed access to the patient's medical context (same rule as the patient chart). */
export type ConsultationAccessMode = 'EXTERNAL_OWNER' | 'OMNICARE_GRANTED' | 'OMNICARE_RESTRICTED';

export interface ConsultationAccess {
  readonly mode: ConsultationAccessMode;
}

/** Administrative identity of the consultation's patient. Never clinical data. */
export interface ConsultationPatient {
  readonly chartId: string;
  readonly patientType: 'EXTERNAL' | 'OMNICARE';
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly ageYears: number | null;
  readonly ageApproximate: boolean;
  readonly sex: 'F' | 'M' | 'OTHER' | null;
  readonly dateOfBirth: string | null;
}

/**
 * Spring-owned operational projection. It carries the patient's administrative identity and the
 * access mode, never clinical content.
 */
export interface ActiveConsultation {
  readonly consultationId: string;
  readonly sourceType: ConsultationSourceType;
  readonly sourceId: string;
  readonly status: ConsultationStatus;
  readonly medicalAccessStatus: MedicalAccessStatus;
  readonly version: number;
  readonly startedAt: string;
  readonly completedAt?: string | null;
  readonly access?: ConsultationAccess | null;
  readonly patient?: ConsultationPatient | null;
  /**
   * Closure state while FINALIZING: `RUNNING` (in progress or retrying), `FAILED` (stopped after
   * its retries; support was alerted, only an administrator can resume or cancel it).
   */
  readonly finishState?: ConsultationFinishState | null;
  /** Practice location of the source appointment (preselected in the follow-up slot picker). */
  readonly sourcePracticeLocationId?: string | null;
  /** G-1 D4: the follow-up slot chosen during the consultation (stored by Spring, not in the note). */
  readonly followUpSlot?: ConsultationFollowUpSlot | null;
  /** G-1 D4: what « Terminer » did with that slot; null when no slot was chosen. */
  readonly followUp?: ConsultationFollowUpOutcome | null;
  /** G-1 D2: the doctor's access request (OmniCare patients only; null for an external patient). */
  readonly accessRequest?: AccessRequestState | null;
}

/** G-1 D2: PENDING until the patient answers; ENDED at finish or abort. */
export type AccessRequestStatus = 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | 'ENDED';

export interface AccessRequestState {
  /** The consultation's latest request. */
  readonly request: {
    readonly requestId: string;
    readonly status: AccessRequestStatus;
    readonly version: number;
    readonly createdAt: string;
    readonly respondedAt: string | null;
  } | null;
  readonly used: number;
  readonly max: number;
  /** Server-decided: in progress, OmniCare patient, no access yet, nothing pending, under the limit. */
  readonly canRequest: boolean;
}

export interface ConsultationFollowUpSlot {
  readonly start: string;
  readonly end: string;
  readonly practiceLocationId: string;
  readonly locationName: string | null;
}

/**
 * PENDING: « Terminer » has not scheduled it yet; CONFIRMED: external patient, booked;
 * PROPOSED: OmniCare patient, waiting for their answer; SLOT_TAKEN: the slot was no longer free.
 */
export type ConsultationFollowUpStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROPOSED' | 'SLOT_TAKEN'
  // Once the proposal has ended, the server reports the appointment's real status (declined/expired → CANCELLED, …).
  | 'CANCELLED' | 'COMPLETED' | 'IN_PROGRESS' | 'NO_SHOW';

export interface ConsultationFollowUpOutcome {
  readonly status: ConsultationFollowUpStatus;
  readonly appointmentId: string | null;
  readonly start: string;
  readonly end: string;
  readonly locationName: string | null;
  readonly proposalExpiresAt: string | null;
}

export type ConsultationFinishState = 'RUNNING' | 'FAILED';

/** « Annuler la consultation » reasons (CTO decision, G-1 P3a). */
export type ConsultationAbortReason = 'PATIENT_ABSENT' | 'PATIENT_LEFT' | 'STARTED_BY_MISTAKE' | 'TECHNICAL_ISSUE';

/**
 * Whether the patient's medical context may be loaded. The server's access mode decides: the
 * owning doctor of an external patient, or an OmniCare patient's grant for this consultation.
 * Without an access mode (older server), the consultation's grant projection decides, as before.
 */
export function canReadMedicalContext(consultation: ActiveConsultation | null | undefined): boolean {
  if (!consultation) return false;
  if (consultation.access) {
    return consultation.access.mode === 'EXTERNAL_OWNER' || consultation.access.mode === 'OMNICARE_GRANTED';
  }
  return consultation.medicalAccessStatus === 'ACTIVE';
}

/** The doctor owns this external patient's record: no authorization step ever applies. */
export function isExternalOwner(consultation: ActiveConsultation | null | undefined): boolean {
  return consultation?.access?.mode === 'EXTERNAL_OWNER';
}

export interface StartConsultationRequest {
  readonly sourceType: ConsultationSourceType;
  readonly sourceId: string;
  readonly expectedSourceVersion: number;
}

export type StartConsultationOutcome =
  | { readonly kind: 'STARTED' | 'RECOVERED'; readonly consultation: ActiveConsultation }
  | { readonly kind: 'ACTIVE_CONFLICT'; readonly consultation: ActiveConsultation }
  | { readonly kind: 'FAILED'; readonly consultation: null };
