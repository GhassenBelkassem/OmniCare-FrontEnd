import type { ConsultationStatus, MedicalAccessStatus } from './active-consultation.models';

export type MedicalRecordSection =
  | 'ESSENTIAL_INFORMATION'
  | 'CURRENT_MEDICATIONS'
  | 'CONSULTATION_SUMMARIES'
  | 'DOCUMENTS';

export type MedicalRecordSectionState = 'AUTHORIZED' | 'NOT_SHARED' | 'DEFERRED';

export interface DoctorMedicalRecordWorkspace {
  readonly consultation: {
    readonly consultationId: string;
    readonly status: ConsultationStatus;
    readonly medicalAccessStatus: MedicalAccessStatus;
    readonly version: number;
  };
  readonly access: {
    readonly state: 'ACTIVE';
    /** EXTERNAL_OWNER (custody, no expiry) or OMNICARE_GRANTED (patient grant). */
    readonly mode?: 'EXTERNAL_OWNER' | 'OMNICARE_GRANTED' | null;
    readonly expiresAt: string | null;
    readonly sections: Readonly<Record<MedicalRecordSection, MedicalRecordSectionState>>;
  };
  readonly essentialInformation: EssentialInformation | null;
  readonly currentMedications: readonly CurrentMedication[];
  readonly consultationSummaries: {
    readonly items: readonly ConsultationSummary[];
    readonly nextCursor: string | null;
  };
  readonly documents: { readonly state: 'DEFERRED' };
}

export interface EssentialInformation {
  readonly bloodType: string | null;
  readonly allergies: readonly string[];
  readonly criticalConditions: readonly string[];
}

export interface CurrentMedication {
  readonly recordVersion: number;
  readonly status: string | null;
  readonly name: string | null;
  readonly code: string | null;
  readonly strength: string | null;
  readonly doseAmount: number | null;
  readonly doseUnit: string | null;
  readonly dosageText: string | null;
  readonly route: string | null;
  readonly timesPerDay: number | null;
  readonly frequencyText: string | null;
  readonly startedAt: string | null;
  readonly expectedEndAt: string | null;
}

export interface ConsultationSummary {
  readonly consultationId: string;
  readonly recordVersion: number;
  readonly schemaVersion: number;
  readonly occurredAt: string | null;
  readonly clinicalCodes: readonly { readonly system: string | null; readonly code: string | null }[];
  readonly chiefComplaint: string | null;
  readonly history: {
    readonly presentIllness: string | null;
    readonly relevantMedicalHistory: string | null;
    readonly relevantDentalHistory: string | null;
  } | null;
  readonly clinicalFindings: readonly {
    readonly type: string | null;
    readonly description: string | null;
  }[];
  readonly diagnoses: readonly {
    readonly system: string | null;
    readonly code: string | null;
    readonly label: string | null;
    readonly status: string | null;
  }[];
  readonly assessment: string | null;
  readonly treatmentPlan: readonly string[];
  readonly followUp: { readonly required: boolean | null; readonly recommendedAt: string | null } | null;
  readonly notes: string | null;
}

export type MedicalRecordFailureCode =
  | 'CLINICAL_ACCESS_REQUIRED'
  | 'CLINICAL_ACCESS_EXPIRED'
  | 'CLINICAL_ACCESS_REVOKED'
  | 'MRS_UNAVAILABLE'
  | 'MRS_CONTEXT_PENDING'
  | 'MRS_CONTEXT_FAILED'
  | 'PROFESSIONAL_NOT_ELIGIBLE'
  | 'CLINICAL_SUBJECT_UNAVAILABLE'
  | 'UNKNOWN';
