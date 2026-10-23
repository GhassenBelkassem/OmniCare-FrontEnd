import type { OcIconIntent, OcIconName, OcStatus } from '../../../shared/ui';

export type UrgentCareMode = 'HOME' | 'CABINET';

export type UrgentDeclaredAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

export type UrgentEffectiveEligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';

export type UrgentOperationalHealth =
  'CURRENT' | 'NOT_CONNECTED' | 'WAITING_RECONNECT' | 'STALE_LOCATION' | 'REALTIME_DEGRADED';

export type UrgentOperationState =
  | 'NONE'
  | 'HOME_ACTIVE'
  | 'CABINET_ACTIVE'
  | 'WAITING_RECONNECT'
  | 'STALE_LOCATION'
  | 'REALTIME_DEGRADED'
  | 'MISSING_ELIGIBILITY';

/**
 * Privacy-minimal shape prepared for the future Angular read-only projection.
 * It deliberately has no patient identity, triage, contact, address or coordinate fields.
 */
export interface UrgentOperationReadProjectionDto {
  readonly state: UrgentOperationState;
  readonly operationalReference: string | null;
  readonly mode: UrgentCareMode | null;
  readonly stateSince: string | null;
  readonly lastSynchronizedAt: string | null;
  readonly freshnessSeconds: number | null;
  readonly reasonCode: string | null;
}

export interface UrgentRuntimeEligibilityDto {
  readonly mode: UrgentCareMode;
  readonly practiceLocationId: string | null;
  readonly practiceLocationLabel: string | null;
  readonly declaredAvailability: UrgentDeclaredAvailability;
  readonly effectiveEligibility: UrgentEffectiveEligibility;
  readonly operationalHealth: UrgentOperationalHealth;
  readonly updatedAt: string | null;
  readonly locationFreshnessSeconds: number | null;
  readonly reasonCode: string | null;
}

export interface UrgentPermanentCapabilityProjection {
  readonly revision: number;
  readonly urgentHomeEnabled: boolean;
  readonly urgentCabinetEnabled: boolean;
  readonly activePracticeLocations: readonly UrgentPracticeLocationProjection[];
}

export interface UrgentPracticeLocationProjection {
  readonly id: string;
  /** Exact trimmed name from the canonical practice-location source, or null when absent. */
  readonly label: string | null;
}

export interface UrgentReadinessStaticFixture {
  readonly synthetic: true;
  readonly fixtureId: string;
  readonly runtimeHome: UrgentRuntimeEligibilityDto;
  readonly runtimeCabinetFallback: UrgentRuntimeEligibilityDto;
  readonly operation: UrgentOperationReadProjectionDto;
}

export interface UrgentOperationPresentation {
  readonly status: OcStatus;
  readonly statusLabel: string;
  readonly title: string;
  readonly description: string;
  readonly icon: OcIconName;
  readonly intent: OcIconIntent;
  readonly showRetry: boolean;
  readonly observation: UrgentObservationPresentation;
  readonly freshnessLabel: string;
}

export interface UrgentRuntimePresentation {
  readonly availability: UrgentStatusPresentation;
  readonly eligibility: UrgentStatusPresentation;
  readonly reason: string;
  readonly reasonTone: OcIconIntent;
  readonly reasonIcon: OcIconName;
  readonly operationalHealthLabel: string;
  readonly observation: UrgentObservationPresentation;
  readonly freshnessLabel: string;
}

export interface UrgentStatusPresentation {
  readonly status: OcStatus;
  readonly label: string;
}

export interface UrgentObservationPresentation {
  readonly label: string;
  readonly dateTime: string | null;
}
