/** Wire contract of `GET/PUT /api/v1/patients/{id}/chart/*`. The server computes `access`. */

export type PatientChartAccessMode = 'EXTERNAL_OWNER' | 'OMNICARE_GRANTED' | 'OMNICARE_RESTRICTED';
export type PatientChartPatientType = 'EXTERNAL' | 'OMNICARE';
export type PatientChartRecordStatus = 'READY' | 'PREPARING' | 'UNAVAILABLE';

export interface PatientChartIdentityDto {
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly ageYears: number | null;
  readonly ageApproximate: boolean;
  readonly sex: 'F' | 'M' | 'OTHER' | null;
  readonly dateOfBirth: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly practiceIdentifier: string | null;
}

export interface PatientChartAccessDto {
  readonly mode: PatientChartAccessMode;
  readonly clinical: boolean;
  readonly editable: boolean;
  readonly grantExpiresAt: string | null;
  readonly verificationUnavailable: boolean;
}

export interface PatientChartAppointmentRefDto {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly status: string;
  readonly version: number;
}

export interface PatientChartConsultationRefDto {
  readonly id: string;
  readonly date: string;
  readonly status: string;
}

export interface PatientChartDto {
  readonly id: string;
  readonly patientType: PatientChartPatientType;
  readonly identity: PatientChartIdentityDto;
  readonly access: PatientChartAccessDto;
  readonly medicalRecord: { readonly status: PatientChartRecordStatus };
  readonly schedulable: boolean;
  readonly nextAppointment: PatientChartAppointmentRefDto | null;
  readonly startableAppointment: PatientChartAppointmentRefDto | null;
  readonly lastConsultation: PatientChartConsultationRefDto | null;
  readonly counts: {
    readonly consultations: number | null;
    readonly documents: number | null;
    readonly history: number | null;
  };
}

export interface PatientChartTreatmentDto {
  readonly name: string;
  readonly strength: string | null;
  readonly dosage: string | null;
  readonly frequency: string | null;
  readonly startedAt: string | null;
  readonly expectedEndAt: string | null;
}

export interface PatientChartMedicalSummaryDto {
  readonly editable: boolean;
  readonly version: number;
  readonly essentialInformationShared: boolean;
  readonly treatmentsShared: boolean;
  readonly bloodType: string | null;
  readonly allergies: readonly string[];
  readonly conditions: readonly string[];
  readonly treatments: readonly PatientChartTreatmentDto[];
}

export interface PatientChartMedicalSummaryUpdateDto {
  readonly expectedVersion: number;
  readonly bloodType: string | null;
  readonly allergies: readonly string[];
  readonly conditions: readonly string[];
}

export interface PatientChartArtifactRefDto {
  readonly id: string;
  readonly kind: 'PRESCRIPTION' | 'CERTIFICATE';
}

export interface PatientChartClinicalConsultationDto {
  readonly id: string;
  readonly date: string | null;
  readonly status: string;
  readonly ownConsultation: boolean;
  readonly clinicalAvailable: boolean;
  readonly reason: string | null;
  readonly diagnosisSummary: string | null;
  readonly artifacts: readonly PatientChartArtifactRefDto[];
}

export interface PatientChartAdministrativeConsultationDto {
  readonly id: string;
  readonly date: string | null;
  readonly status: string;
}

export type PatientChartConsultationsDto =
  | { readonly view: 'CLINICAL'; readonly items: readonly PatientChartClinicalConsultationDto[] }
  | {
      readonly view: 'ADMINISTRATIVE';
      readonly items: readonly PatientChartAdministrativeConsultationDto[];
    };

export interface PatientChartDocumentDto {
  readonly id: string;
  readonly type: string | null;
  readonly name: string | null;
  readonly status: string;
  readonly contentType: string | null;
  readonly pageCount: number | null;
  readonly createdAt: string;
  readonly previewable: boolean;
}

export interface PatientChartDocumentsDto {
  readonly canUpload: boolean;
  readonly items: readonly PatientChartDocumentDto[];
  readonly nextCursor: string | null;
}

export interface PatientChartDocumentPreviewDto {
  readonly sessionId: string;
  readonly pageCount: number;
  readonly expiresAt: string | null;
  readonly token: string;
}

export type PatientChartHistoryKind =
  | 'PATIENT_CREATED'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_COMPLETED'
  | 'APPOINTMENT_NO_SHOW'
  | 'CONSULTATION_COMPLETED'
  | 'DOCUMENT_ADDED'
  | 'PRESCRIPTION_ISSUED';

export interface PatientChartHistoryEventDto {
  readonly id: string;
  readonly kind: PatientChartHistoryKind;
  readonly occurredAt: string;
  readonly appointmentStart: string | null;
  readonly label: string | null;
  readonly targetType: 'APPOINTMENT' | 'CONSULTATION' | 'DOCUMENT' | null;
  readonly targetId: string | null;
}

export interface PatientChartHistoryDto {
  readonly clinicalIncluded: boolean;
  readonly clinicalUnavailable: boolean;
  readonly items: readonly PatientChartHistoryEventDto[];
}

export type PatientChartDocumentType =
  | 'LAB_RESULT'
  | 'IMAGING'
  | 'PRESCRIPTION_DOCUMENT'
  | 'REFERRAL'
  | 'DISCHARGE_SUMMARY'
  | 'VACCINATION'
  | 'OTHER_MEDICAL_DOCUMENT';
