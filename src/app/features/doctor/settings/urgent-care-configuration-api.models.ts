export type ExactDecimal = string;

export interface UrgentCareConfigurationResponse {
  readonly revision: number;
  readonly home: {
    readonly consultationFeeTnd: ExactDecimal | null;
    readonly feeConfigured: boolean;
    readonly maxTravelKm: ExactDecimal | null;
    readonly maxTravelDistanceConfigured: boolean;
  };
  readonly cabinet: {
    readonly consultationFeeTnd: ExactDecimal | null;
    readonly feeConfigured: boolean;
  };
}

export interface ReplaceUrgentCareConfigurationRequest {
  readonly expectedRevision: number;
  readonly homeFeeTnd: ExactDecimal | null;
  readonly cabinetFeeTnd: ExactDecimal | null;
  readonly maxHomeTravelKm: ExactDecimal | null;
}

export type KnownUrgentReadinessBlockingReason =
  | 'CAPABILITY_DISABLED'
  | 'HOME_FEE_NOT_CONFIGURED'
  | 'HOME_TRAVEL_DISTANCE_NOT_CONFIGURED'
  | 'CABINET_FEE_NOT_CONFIGURED'
  | 'NO_ACTIVE_CABINET'
  | 'PROFESSIONAL_NOT_ELIGIBLE'
  | 'RUNTIME_HOME_INTENT_DISABLED'
  | 'RUNTIME_CABINET_INTENT_DISABLED'
  | 'CLINICAL_BUSY'
  | 'ACTIVE_URGENT_CAPACITY_CLAIM'
  | 'POST_HANDOFF_UNAVAILABLE'
  | 'LOCATION_MISSING'
  | 'LOCATION_STALE'
  | 'LOCATION_ACCURACY_INSUFFICIENT'
  | 'LOCATION_PRESENCE_UNAVAILABLE'
  | 'REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED';

/**
 * The backend catalog is closed today, but clients must remain safe when a newer backend adds a
 * reason before this dashboard is redeployed.
 */
export type UrgentReadinessBlockingReason =
  KnownUrgentReadinessBlockingReason | (string & Record<never, never>);

export interface UrgentModeReadinessResponse {
  readonly capabilityEnabled: boolean;
  readonly configurationReady: boolean;
  readonly runtimeAvailabilityIntent: boolean;
  readonly effectiveCurrentEligibility: boolean;
  readonly blockingReasons: readonly UrgentReadinessBlockingReason[];
}

export interface UrgentCareReadinessResponse {
  readonly revision: number;
  readonly professionalEligible: boolean;
  readonly home: UrgentModeReadinessResponse;
  readonly cabinet: UrgentModeReadinessResponse;
  readonly completeLiveMatchingEligibilityEvaluated: boolean;
  readonly evaluatedAt: string;
}
