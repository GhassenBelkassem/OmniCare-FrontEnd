import { describe, expect, it } from 'vitest';

import { readinessReasonPresentation } from './readiness-reason-presentation';

describe('readinessReasonPresentation', () => {
  it('maps remediation reasons to the appropriate existing Settings tab', () => {
    expect(readinessReasonPresentation('PROFESSIONAL_PROFILE_MISSING').action?.tab).toBe('profile');
    expect(readinessReasonPresentation('NOT_ACCEPTING_NEW_PATIENTS').action?.tab).toBe('profile');
    expect(readinessReasonPresentation('NO_ACTIVE_CABINET').action?.tab).toBe('cabinets');
    expect(readinessReasonPresentation('CABINET_CAPABILITY_DISABLED').action?.tab).toBe('services');
  });

  it('does not offer a fake self-verification action', () => {
    expect(readinessReasonPresentation('PROFESSIONAL_NOT_VERIFIED').action).toBeUndefined();
  });

  it('fails safely for a future unknown reason', () => {
    const unknown = readinessReasonPresentation('FUTURE_BACKEND_REASON');
    expect(unknown.title).toBe('Configuration à vérifier');
    expect(unknown.description).not.toContain('FUTURE_BACKEND_REASON');
    expect(unknown.action).toBeUndefined();
  });
});
