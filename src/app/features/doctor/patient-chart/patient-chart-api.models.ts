import type { AccessRequestState } from '../active-consultation.models';
import type { RecordBodyMeasurements } from './record/patient-record.models';

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
  /** Optimistic version of the contact details (G-1 P3b); 0 for an OmniCare patient. */
  readonly contactVersion?: number;
}

export interface PatientChartAccessDto {
  readonly mode: PatientChartAccessMode;
  readonly clinical: boolean;
  readonly editable: boolean;
  readonly grantExpiresAt: string | null;
  readonly verificationUnavailable: boolean;
  /**
   * G-1 D5: the clinical sections this doctor may read (ESSENTIAL_INFORMATION, CURRENT_MEDICATIONS,
   * CONSULTATION_SUMMARIES, DOCUMENTS). Absent from an older server: then every section is tried.
   */
  readonly sections?: readonly PatientChartSection[];
}

export type PatientChartSection = 'ESSENTIAL_INFORMATION' | 'CURRENT_MEDICATIONS' | 'CONSULTATION_SUMMARIES' | 'DOCUMENTS';

export interface PatientChartAppointmentRefDto {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly status: string;
  readonly version: number;
  /** Name of the cabinet (G-1 P3b), null when the appointment has none. */
  readonly locationName?: string | null;
}

/**
 * `PATCH /patients/{id}/contact` body: a present field changes, `null` clears it. At most one of
 * `dateOfBirth` / `approximateAgeYears` (it replaces the other).
 */
export interface PatientContactUpdateRequest {
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly practiceIdentifier?: string | null;
  readonly dateOfBirth?: string;
  readonly approximateAgeYears?: number;
  readonly expectedVersion: number;
}

export interface PatientContactUpdateResponse {
  readonly identity: PatientChartIdentityDto;
  readonly contactVersion: number;
  readonly possibleDuplicate: boolean;
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
  /**
   * G-1 D2: access request of this doctor's consultation in progress with this OmniCare patient;
   * null when there is none (then the chart only explains how the patient can share).
   */
  readonly accessRequest?: (AccessRequestState & { readonly consultationId: string }) | null;
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

export type SummaryStatus = 'UNKNOWN' | 'NONE_KNOWN' | 'LIST';

export interface PatientChartMedicalSummaryDto {
  /** Always false: the summary is updated through a consultation (G-1 P2a). */
  readonly editable: boolean;
  readonly version: number;
  readonly essentialInformationShared: boolean;
  readonly treatmentsShared: boolean;
  readonly bloodType: string | null;
  readonly allergies: readonly string[];
  readonly conditions: readonly string[];
  /** Null when not shared; UNKNOWN « Non renseigné », NONE_KNOWN « Aucune connue », LIST = items. */
  readonly allergiesStatus?: SummaryStatus | null;
  readonly conditionsStatus?: SummaryStatus | null;
  readonly treatments: readonly PatientChartTreatmentDto[];
  /** Patient-written measurements (G-1 P2d), null when none or not shared. */
  readonly bodyMeasurements?: RecordBodyMeasurements | null;
}


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
