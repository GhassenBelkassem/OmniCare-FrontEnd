import { InjectionToken } from '@angular/core';

import {
  UrgentOperationReadProjectionDto,
  UrgentReadinessStaticFixture,
  UrgentRuntimeEligibilityDto,
} from './urgent-readiness.models';

const FIXTURE_TIME = '2026-10-10T09:30:00.000Z';

export const URGENT_OPERATION_FIXTURES = {
  none: operation('NONE'),
  homeActive: operation('HOME_ACTIVE', 'HOME', 'URG-DEMO-H-0247'),
  cabinetActive: operation('CABINET_ACTIVE', 'CABINET', 'URG-DEMO-C-0184'),
  waitingReconnect: operation('WAITING_RECONNECT', 'HOME', 'URG-DEMO-H-0312'),
  staleLocation: operation('STALE_LOCATION', 'HOME', 'URG-DEMO-H-0419', 480),
  realtimeDegraded: operation('REALTIME_DEGRADED', 'CABINET', 'URG-DEMO-C-0266'),
  missingEligibility: operation('MISSING_ELIGIBILITY', 'HOME'),
} as const satisfies Record<string, UrgentOperationReadProjectionDto>;

export const URGENT_RUNTIME_FIXTURES = {
  availableHome: runtime('HOME', 'AVAILABLE', 'ELIGIBLE', 'CURRENT', null, null, 38),
  waitingReconnect: runtime(
    'HOME',
    'AVAILABLE',
    'UNKNOWN',
    'WAITING_RECONNECT',
    null,
    'REALTIME_RECONNECTING',
    84,
  ),
  staleLocation: runtime(
    'HOME',
    'AVAILABLE',
    'INELIGIBLE',
    'STALE_LOCATION',
    null,
    'LOCATION_STALE',
    480,
  ),
  realtimeDegraded: runtime(
    'HOME',
    'UNKNOWN',
    'UNKNOWN',
    'REALTIME_DEGRADED',
    null,
    'REALTIME_OFFLINE',
    118,
  ),
  missingHomeEligibility: runtime(
    'HOME',
    'UNKNOWN',
    'INELIGIBLE',
    'NOT_CONNECTED',
    null,
    'CAPABILITY_DISABLED',
  ),
  unavailableCabinet: runtime(
    'CABINET',
    'UNKNOWN',
    'UNKNOWN',
    'NOT_CONNECTED',
    'CAB-DEMO-001',
    'RUNTIME_PROJECTION_NOT_CONNECTED',
  ),
  missingCabinetEligibility: runtime(
    'CABINET',
    'UNKNOWN',
    'INELIGIBLE',
    'NOT_CONNECTED',
    null,
    'ACTIVE_PRACTICE_LOCATION_REQUIRED',
  ),
} as const satisfies Record<string, UrgentRuntimeEligibilityDto>;

/**
 * Safe default for the static Angular surface. It never depicts a real urgent operation.
 * Permanent capability values are loaded separately from the existing settings contract.
 */
export const SAFE_URGENT_READINESS_FIXTURE: UrgentReadinessStaticFixture = {
  synthetic: true,
  fixtureId: 'p4-ui-01-safe-empty',
  runtimeHome: {
    ...URGENT_RUNTIME_FIXTURES.realtimeDegraded,
    updatedAt: null,
    locationFreshnessSeconds: null,
    reasonCode: 'RUNTIME_PROJECTION_NOT_CONNECTED',
  },
  runtimeCabinetFallback: {
    ...URGENT_RUNTIME_FIXTURES.unavailableCabinet,
    updatedAt: null,
    locationFreshnessSeconds: null,
  },
  operation: URGENT_OPERATION_FIXTURES.none,
};

export const URGENT_READINESS_STATIC_FIXTURE = new InjectionToken<UrgentReadinessStaticFixture>(
  'URGENT_READINESS_STATIC_FIXTURE',
  {
    providedIn: 'root',
    factory: () => SAFE_URGENT_READINESS_FIXTURE,
  },
);

function operation(
  state: UrgentOperationReadProjectionDto['state'],
  mode: UrgentOperationReadProjectionDto['mode'] = null,
  operationalReference: string | null = null,
  freshnessSeconds: number | null = 42,
): UrgentOperationReadProjectionDto {
  return {
    state,
    mode,
    operationalReference,
    stateSince: state === 'NONE' || state === 'MISSING_ELIGIBILITY' ? null : FIXTURE_TIME,
    lastSynchronizedAt: state === 'NONE' ? null : FIXTURE_TIME,
    freshnessSeconds: state === 'NONE' ? null : freshnessSeconds,
    reasonCode: reasonForOperation(state),
  };
}

function runtime(
  mode: UrgentRuntimeEligibilityDto['mode'],
  declaredAvailability: UrgentRuntimeEligibilityDto['declaredAvailability'],
  effectiveEligibility: UrgentRuntimeEligibilityDto['effectiveEligibility'],
  operationalHealth: UrgentRuntimeEligibilityDto['operationalHealth'],
  practiceLocationId: string | null,
  reasonCode: string | null,
  locationFreshnessSeconds: number | null = null,
): UrgentRuntimeEligibilityDto {
  return {
    mode,
    declaredAvailability,
    effectiveEligibility,
    operationalHealth,
    practiceLocationId,
    practiceLocationLabel: null,
    updatedAt: FIXTURE_TIME,
    locationFreshnessSeconds,
    reasonCode,
  };
}

function reasonForOperation(state: UrgentOperationReadProjectionDto['state']): string | null {
  switch (state) {
    case 'WAITING_RECONNECT':
      return 'REALTIME_RECONNECTING';
    case 'STALE_LOCATION':
      return 'LOCATION_STALE';
    case 'REALTIME_DEGRADED':
      return 'REALTIME_OFFLINE';
    case 'MISSING_ELIGIBILITY':
      return 'CAPABILITY_DISABLED';
    default:
      return null;
  }
}
