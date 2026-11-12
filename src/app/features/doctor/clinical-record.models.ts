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

/** Three states of an allergy / antécédent list (LIFE_SAFETY v2). */
export type SummaryStatus = 'UNKNOWN' | 'NONE_KNOWN' | 'LIST';

export interface MedicalSummaryList {
  readonly status: SummaryStatus;
  readonly items: readonly string[];
}

/**
 * Update of the patient's medical summary carried by the note (EXTERNAL_OWNER only). Applied at
 * Finish. A null part is left unchanged.
 */
export interface MedicalSummaryUpdate {
  readonly bloodType: string | null;
  readonly allergies: MedicalSummaryList | null;
  readonly conditions: MedicalSummaryList | null;
}

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
  readonly medicalSummaryUpdate?: MedicalSummaryUpdate | null;
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
  medicalSummaryUpdate: null,
};
