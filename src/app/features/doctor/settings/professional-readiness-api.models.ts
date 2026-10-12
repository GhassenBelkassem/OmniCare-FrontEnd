export type KnownDoctorEligibilityReason =
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_UNAVAILABLE'
  | 'ADMIN_SUSPENDED'
  | 'PROFESSIONAL_PROFILE_MISSING'
  | 'PROFESSIONAL_NOT_VERIFIED'
  | 'NOT_ACCEPTING_NEW_PATIENTS'
  | 'CABINET_CAPABILITY_DISABLED'
  | 'NO_ACTIVE_CABINET';

/** Keeps future backend reason codes renderable without weakening the known-code contract. */
export type DoctorEligibilityReason = KnownDoctorEligibilityReason | (string & {});

export interface DiscoveryReadinessResponse {
  readonly discoverable: boolean;
  readonly blockingReasons: readonly DoctorEligibilityReason[];
}

export interface CabinetReadinessResponse extends DiscoveryReadinessResponse {
  readonly capabilityEnabled: boolean;
  readonly activeCabinetCount: number;
}

export interface ProfessionalVerificationResponse {
  readonly verified: boolean;
  readonly verifiedAt: string | null;
}

export interface ProfessionalReadinessResponse {
  readonly publicDirectory: DiscoveryReadinessResponse;
  readonly cabinet: CabinetReadinessResponse;
  readonly acceptingNewPatients: boolean;
  readonly professionalVerification: ProfessionalVerificationResponse;
  readonly evaluatedAt: string;
}
