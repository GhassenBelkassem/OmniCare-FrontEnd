export type ConsultationSourceType = 'SCHEDULED_APPOINTMENT' | 'URGENT_HOME' | 'URGENT_CABINET';

export type ConsultationStatus = 'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | 'ABORTED';

export type MedicalAccessStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'UNAVAILABLE';

/** Safe Spring-owned operational projection. It intentionally contains no PHI. */
export interface ActiveConsultation {
  readonly consultationId: string;
  readonly sourceType: ConsultationSourceType;
  readonly sourceId: string;
  readonly status: ConsultationStatus;
  readonly medicalAccessStatus: MedicalAccessStatus;
  readonly version: number;
  readonly startedAt: string;
}
