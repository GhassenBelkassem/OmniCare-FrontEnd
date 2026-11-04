export type MedicationDecision = 'MEDICATION_PRESCRIBED' | 'NO_MEDICATION';

export interface PrescriptionMedication {
  readonly itemId: string;
  readonly replacesItemId: string | null;
  readonly medicationCode: string | null;
  readonly name: string | null;
  readonly strength: string | null;
  readonly dose: { readonly amount: number; readonly unit: string };
  readonly route: string;
  readonly frequency: { readonly timesPerDay: number | null; readonly text: string | null };
  readonly duration: { readonly value: number; readonly unit: 'DAY' | 'WEEK' | 'MONTH' } | null;
  readonly quantity: number | null;
  readonly instructions: string | null;
}

export interface PrescriptionContent {
  readonly medications: readonly PrescriptionMedication[];
  readonly generalInstructions: string | null;
}

export interface PrescriptionResponse {
  readonly prescriptionId: string | null;
  readonly prescriptionVersion: number;
  readonly clinicalRecordVersion: number;
  readonly schemaVersion: number;
  readonly status: 'NONE' | 'DRAFT' | 'ACTIVE';
  readonly finalized: boolean;
  readonly signedAt: string | null;
  readonly signatureAlgorithm: string | null;
  readonly medicationDecision: MedicationDecision | null;
  readonly prescription: PrescriptionContent | null;
}

export const EMPTY_PRESCRIPTION: PrescriptionContent = { medications: [], generalInstructions: null };
