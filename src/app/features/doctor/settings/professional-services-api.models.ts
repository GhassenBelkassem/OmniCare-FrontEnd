export type CareCapability = 'CABINET' | 'HOME_VISIT' | 'URGENT_HOME' | 'URGENT_CABINET';

export interface CareCapabilityResponse {
  readonly revision: number;
  readonly capabilities: readonly CareCapability[];
}

export interface ReplaceCareCapabilitiesRequest {
  readonly expectedRevision: number;
  readonly capabilities: readonly CareCapability[];
}

export interface EquipmentDefinitionResponse {
  readonly code: string;
  readonly displayName: string;
  readonly portable: boolean;
  readonly active: boolean;
}

export interface EquipmentConfigurationResponse {
  readonly revision: number;
  readonly equipment: readonly EquipmentDefinitionResponse[];
}

export interface EquipmentOverviewResponse {
  readonly catalog: readonly EquipmentDefinitionResponse[];
  readonly mobile: EquipmentConfigurationResponse;
}

export interface PracticeLocationEquipmentResponse {
  readonly practiceLocationId: string;
  readonly revision: number;
  readonly equipment: readonly EquipmentDefinitionResponse[];
}

export interface ReplaceEquipmentRequest {
  readonly expectedRevision: number;
  readonly equipmentCodes: readonly string[];
}

export type CoverageAcceptance = 'NOT_DECLARED' | 'ACCEPTED' | 'NOT_ACCEPTED';
export type CoverageProvenance = 'DECLARED';

export interface CoverageClaimResponse {
  readonly acceptance: CoverageAcceptance;
  readonly provenance: CoverageProvenance | null;
  readonly verified: boolean;
}

export interface PracticeLocationCoverageResponse {
  readonly practiceLocationId: string;
  readonly revision: number;
  readonly selfPay: CoverageClaimResponse;
  readonly cnam: CoverageClaimResponse;
  readonly privateInsurance: CoverageClaimResponse;
  readonly specificPrivateInsurerDetailsAvailable: boolean;
}

export interface ReplacePracticeLocationCoverageRequest {
  readonly expectedRevision: number;
  readonly selfPayAcceptance: CoverageAcceptance;
  readonly cnamAcceptance: CoverageAcceptance;
  readonly privateInsuranceAcceptance: CoverageAcceptance;
}
