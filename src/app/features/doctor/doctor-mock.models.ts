export type ConsultationMode = 'active' | 'readonly';
export type ConsultationSource = 'qr' | 'manual' | 'urgent';

export interface MockPatient {
  readonly id: string;
  readonly name: string;
  readonly dob: string;
  readonly phone: string;
}

export interface MockVitals {
  systolicBP: number | null;
  diastolicBP: number | null;
  heartRate: number | null;
  temperature: number | null;
  weight: number | null;
}

export interface MockPrescriptionLine {
  id: number;
  drugName: string;
  dosage: string;
  timing: string;
  duration: string;
}

export interface MockConsultation {
  readonly id: string;
  readonly patientId: string;
  readonly status: 'active' | 'closed';
  readonly dateLabel: string;
  readonly source: ConsultationSource;
  diagnosis: string;
  treatment: string;
  vitals: MockVitals;
  prescriptionLines: MockPrescriptionLine[];
}

export interface PastConsultation {
  readonly id: string;
  readonly date: string;
  readonly diagnosisLabel: string;
}

export interface MockMedicalRecord {
  readonly patient: MockPatient;
  readonly pastConsultations: readonly PastConsultation[];
}

export interface ConsultationDraft {
  readonly diagnosis: string;
  readonly treatment: string;
  readonly vitals: MockVitals;
  readonly prescriptionLines: readonly MockPrescriptionLine[];
  readonly scribeText: string;
  readonly ordonnanceText: string;
}

export interface UrgentRequest {
  readonly id: string;
  readonly patientName: string;
  readonly distance: string;
  readonly location: string;
  readonly reason: string;
}

export interface MockPatientMatch {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
}

export interface MockPatientCreateDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly dateOfBirth: string;
  readonly source: 'omnicare' | 'external';
}
