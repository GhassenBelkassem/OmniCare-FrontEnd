import { describe, expect, it } from 'vitest';

import { KnownUrgentReadinessBlockingReason } from './urgent-care-configuration-api.models';
import { urgentReadinessReasonPresentation } from './urgent-care-readiness-presentation';

describe('urgentReadinessReasonPresentation', () => {
  it('provides French, privacy-safe copy for every backend reason', () => {
    const reasons: readonly KnownUrgentReadinessBlockingReason[] = [
      'CAPABILITY_DISABLED',
      'HOME_FEE_NOT_CONFIGURED',
      'HOME_TRAVEL_DISTANCE_NOT_CONFIGURED',
      'CABINET_FEE_NOT_CONFIGURED',
      'NO_ACTIVE_CABINET',
      'PROFESSIONAL_NOT_ELIGIBLE',
      'RUNTIME_HOME_INTENT_DISABLED',
      'RUNTIME_CABINET_INTENT_DISABLED',
      'CLINICAL_BUSY',
      'ACTIVE_URGENT_CAPACITY_CLAIM',
      'POST_HANDOFF_UNAVAILABLE',
      'LOCATION_MISSING',
      'LOCATION_STALE',
      'LOCATION_ACCURACY_INSUFFICIENT',
      'LOCATION_PRESENCE_UNAVAILABLE',
      'REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED',
    ];

    for (const reason of reasons) {
      const presentation = urgentReadinessReasonPresentation(reason);
      expect(presentation.title.length).toBeGreaterThan(0);
      expect(presentation.description.length).toBeGreaterThan(0);
      expect(presentation.description).not.toContain(reason);
    }
  });

  it('fails safely without exposing a future raw backend reason', () => {
    const presentation = urgentReadinessReasonPresentation('FUTURE_INTERNAL_REASON');

    expect(presentation.title).toBe('Condition supplémentaire à vérifier');
    expect(presentation.description).not.toContain('FUTURE_INTERNAL_REASON');
  });
});
