export type UrgentCabinetCommitmentStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'INVALIDATED'
  | 'COMPLETED';

/** Doctor-owned, PHI-free clinical convergence projection. */
export interface UrgentCabinetClinicalCommitment {
  readonly commitmentId: string;
  readonly requestId: string;
  readonly practiceLocationId: string;
  readonly status: UrgentCabinetCommitmentStatus;
  readonly revision: number;
  readonly arrivalVerifiedAt: string | null;
  readonly capacityBinding: 'EXCLUSIVE_CAPACITY' | 'DEFERRED_CLINICAL_BUSY' | null;
  readonly clinicalStartReady: boolean;
  readonly consultationId: string | null;
  readonly consultationStatus: 'IN_PROGRESS' | 'FINALIZING' | 'COMPLETED' | null;
  readonly clinicalStartedAt: string | null;
  readonly completedAt: string | null;
  readonly allowedActions: readonly ('VERIFY_ARRIVAL' | 'START_CONSULTATION')[];
  readonly evaluatedAt: string;
}

export interface UrgentCabinetProtectedIntakeResponse {
  readonly requestId: string;
  readonly bodyAreaCodes: readonly string[] | null;
  readonly painScore: number | null;
  readonly shortDescription: string | null;
}

export interface UrgentCabinetProtectedIntakeContext
  extends UrgentCabinetProtectedIntakeResponse {
  readonly commitmentId: string;
}
