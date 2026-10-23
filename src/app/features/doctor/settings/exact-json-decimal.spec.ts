import { describe, expect, it } from 'vitest';

import {
  parseUrgentConfigurationJson,
  serializeUrgentConfigurationRequest,
} from './exact-json-decimal';

describe('urgent configuration exact JSON', () => {
  it('preserves decimal lexemes beyond the JavaScript safe scaled-integer range', () => {
    const response = parseUrgentConfigurationJson(
      '{"revision":7,"home":{"consultationFeeTnd":0.000,"feeConfigured":true,"maxTravelKm":999999999999.999999,"maxTravelDistanceConfigured":true},"cabinet":{"consultationFeeTnd":12345678.999,"feeConfigured":true}}',
    );
    expect(response.home.consultationFeeTnd).toBe('0.000');
    expect(response.home.maxTravelKm).toBe('999999999999.999999');
    expect(response.cabinet.consultationFeeTnd).toBe('12345678.999');
  });

  it('serializes exact decimals as JSON numbers and retains null', () => {
    expect(
      serializeUrgentConfigurationRequest({
        expectedRevision: 9,
        homeFeeTnd: '0.000',
        cabinetFeeTnd: null,
        maxHomeTravelKm: '999999999999.999999',
      }),
    ).toBe(
      '{"expectedRevision":9,"homeFeeTnd":0.000,"cabinetFeeTnd":null,"maxHomeTravelKm":999999999999.999999}',
    );
  });
});
