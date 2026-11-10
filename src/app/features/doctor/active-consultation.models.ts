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
}

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
