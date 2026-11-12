/**
 * Wire contract of the doctor's « Dossier patient » (G-1 P2d), under `/api/v1/patients/{id}/chart`.
 * The server decides access; RESTRICTED never receives a clinical field.
 */

export type RecordConsultationStatus = 'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | 'ABORTED' | string;

export interface RecordDoctor {
  readonly name: string;
  readonly specialty: string | null;
}

/** `GET /consultations?cursor&size` item. Clinical fields are absent in the ADMINISTRATIVE view. */
export interface RecordConsultationItem {
  readonly id: string;
  readonly date: string | null;
  readonly status: RecordConsultationStatus;
  readonly ownConsultation?: boolean;
  readonly doctor: RecordDoctor | null;
  readonly clinicalAvailable?: boolean;
  readonly reason?: string | null;
  readonly diagnosisSummary?: string | null;
}

export interface RecordConsultationPage {
  readonly view: 'CLINICAL' | 'ADMINISTRATIVE';
  readonly items: readonly RecordConsultationItem[];
  readonly nextCursor: string | null;
  readonly total: number | null;
}

export interface RecordDose {
  readonly amount: number;
  readonly unit: string;
}

export interface RecordDuration {
  readonly value: number;
  readonly unit: 'DAY' | 'WEEK' | 'MONTH' | string;
}

export interface RecordPrescriptionLine {
  readonly name: string;
  readonly strength: string | null;
  readonly dose: RecordDose | null;
  readonly route: string | null;
  readonly timesPerDay: number | null;
  readonly frequencyText: string | null;
  readonly duration: RecordDuration | null;
  readonly longTerm: boolean;
  readonly quantity: number | null;
  readonly instructions: string | null;
}

export type RecordDocumentType =
  | 'PRESCRIPTION' | 'SICK_LEAVE_CERTIFICATE' | 'MEDICAL_CERTIFICATE' | 'LAB_ORDER' | 'IMAGING_ORDER' | string;

export interface RecordConsultationDocument {
  readonly id: string;
  readonly type: RecordDocumentType;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly downloadable: boolean;
}

/** `GET /consultations/{cid}`. An in-progress consultation carries its status only. */
export interface RecordConsultationDetail {
  readonly id: string;
  readonly date: string | null;
  readonly status: RecordConsultationStatus;
  readonly doctor: RecordDoctor | null;
  readonly clinicalAvailable: boolean;
  readonly chiefComplaint?: string | null;
  readonly presentIllness?: string | null;
  readonly examination?: string | null;
  readonly assessment?: string | null;
  readonly notes?: string | null;
  readonly diagnoses?: readonly { readonly label: string; readonly status: string }[];
  readonly medicationDecision?: 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION' | null;
  readonly prescription?: { readonly signedAt: string | null; readonly medications: readonly RecordPrescriptionLine[] } | null;
  readonly orders?: readonly { readonly category: 'LAB' | 'IMAGING' | 'REFERRAL' | string; readonly target: string }[];
  readonly followUp?: { readonly decision: string | null; readonly date: string | null } | null;
  readonly documents?: readonly RecordConsultationDocument[];
}

/** `GET /medications?state=current|past`. */
export interface RecordMedication {
  readonly id: string;
  readonly name: string;
  readonly strength: string | null;
  readonly dose: RecordDose | null;
  readonly route: string | null;
  readonly timesPerDay: number | null;
  readonly frequencyText: string | null;
  readonly duration: RecordDuration | null;
  readonly longTerm: boolean;
  readonly startedAt: string | null;
  readonly endsAt: string | null;
  readonly prescribedAt: string | null;
}

export interface RecordMedicationList {
  readonly state: 'current' | 'past';
  readonly activeCount: number;
  readonly items: readonly RecordMedication[];
}

/** Additive field of `GET /medical-summary` (patient-written, read-only). */
export interface RecordBodyMeasurements {
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly measuredAt: string | null;
}
