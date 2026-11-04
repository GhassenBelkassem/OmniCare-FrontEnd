export interface ClinicalHistory {
  readonly presentIllness: string | null;
  readonly relevantMedicalHistory: string | null;
  readonly relevantDentalHistory: string | null;
}

export interface ClinicalFinding {
  readonly type: string;
  readonly description: string;
}

export interface ClinicalDiagnosis {
  readonly system: string;
  readonly code: string;
  readonly label: string;
  readonly status: string;
}

export interface ClinicalFollowUp {
  readonly required: boolean;
  readonly recommendedAt: string | null;
  readonly decision: FollowUpDecision | null;
}

export type FollowUpDecision =
  | 'NO_FOLLOW_UP'
  | 'FOLLOW_UP_IN_PERIOD'
  | 'FOLLOW_UP_AFTER_RESULTS'
  | 'FOLLOW_UP_AS_NEEDED';

export interface ClinicalRecordPayload {
  readonly chiefComplaint: string | null;
  readonly history: ClinicalHistory;
  readonly clinicalFindings: readonly ClinicalFinding[];
  readonly diagnoses: readonly ClinicalDiagnosis[];
  readonly assessment: string | null;
  readonly treatmentPlan: readonly string[];
  readonly followUp: ClinicalFollowUp;
  readonly notes: string | null;
  readonly medicationDecision: 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION' | null;
}

export interface ClinicalRecordResponse {
  readonly clinicalRecordVersion: number;
  readonly schemaVersion: number;
  readonly clinicalRecord: ClinicalRecordPayload;
}

export const EMPTY_CLINICAL_RECORD: ClinicalRecordPayload = {
  chiefComplaint: null,
  history: {
    presentIllness: null,
    relevantMedicalHistory: null,
    relevantDentalHistory: null,
  },
  clinicalFindings: [],
  diagnoses: [],
  assessment: null,
  treatmentPlan: [],
  followUp: { required: false, recommendedAt: null, decision: null },
  notes: null,
  medicationDecision: null,
};
