import { describe, expect, it } from 'vitest';

import { DOCTOR_FEATURES, isDoctorFeatureEnabled } from './doctor-features';

describe('doctor feature flags', () => {
  it('hides unfinished features in production by default', () => {
    expect(DOCTOR_FEATURES).toEqual({
      waitingRoom: false,
      results: false,
      analytics: false,
      billing: false,
      prescriptions: false,
      urgentReadiness: false,
    });
    expect(isDoctorFeatureEnabled('waitingRoom', DOCTOR_FEATURES, false)).toBe(false);
  });

  it('shows a feature once its flag is on, and always in the static demo', () => {
    expect(isDoctorFeatureEnabled('results', { ...DOCTOR_FEATURES, results: true }, false)).toBe(true);
    expect(isDoctorFeatureEnabled('analytics', DOCTOR_FEATURES, true)).toBe(true);
  });
});
