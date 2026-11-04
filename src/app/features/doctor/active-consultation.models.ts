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
  readonly completedAt?: string | null;
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
