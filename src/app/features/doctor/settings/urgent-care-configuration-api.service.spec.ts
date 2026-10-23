import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { UrgentCareConfigurationApiService } from './urgent-care-configuration-api.service';

describe('UrgentCareConfigurationApiService', () => {
  it('uses the self-owned P4-03A paths and exact text transport', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const api = TestBed.inject(UrgentCareConfigurationApiService);
    const http = TestBed.inject(HttpTestingController);
    let distance: string | null = null;
    api.get().subscribe((response) => (distance = response.home.maxTravelKm));
    const get = http.expectOne('/api/v1/me/care-capabilities/urgent-configuration');
    expect(get.request.method).toBe('GET');
    expect(get.request.responseType).toBe('text');
    get.flush(configurationJson(2, '999999999999.999999'));
    expect(distance).toBe('999999999999.999999');

    api
      .replace({
        expectedRevision: 2,
        homeFeeTnd: '75.125',
        cabinetFeeTnd: null,
        maxHomeTravelKm: '20.000001',
      })
      .subscribe();
    const put = http.expectOne('/api/v1/me/care-capabilities/urgent-configuration');
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Content-Type')).toBe('application/json');
    expect(put.request.body).toBe(
      '{"expectedRevision":2,"homeFeeTnd":75.125,"cabinetFeeTnd":null,"maxHomeTravelKm":20.000001}',
    );
    put.flush(configurationJson(3, '20.000001'));
    http.verify();
  });

  it('reads readiness from the exact Doctor-self endpoint without a request body', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const api = TestBed.inject(UrgentCareConfigurationApiService);
    const http = TestBed.inject(HttpTestingController);

    api.readiness().subscribe((response) => expect(response.revision).toBe(6));
    const request = http.expectOne('/api/v1/me/care-capabilities/urgent-configuration/readiness');
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({
      revision: 6,
      professionalEligible: true,
      home: mode(),
      cabinet: mode(),
      completeLiveMatchingEligibilityEvaluated: false,
      evaluatedAt: '2026-10-15T10:00:00Z',
    });
    http.verify();
  });
});

function mode() {
  return {
    capabilityEnabled: true,
    configurationReady: true,
    runtimeAvailabilityIntent: false,
    effectiveCurrentEligibility: false,
    blockingReasons: ['RUNTIME_HOME_INTENT_DISABLED'],
  };
}

export function configurationJson(
  revision: number,
  distance: string | null = '20.500000',
  homeFee: string | null = '75.000',
  cabinetFee: string | null = '60.000',
): string {
  const value = (decimal: string | null) => decimal ?? 'null';
  return `{"revision":${revision},"home":{"consultationFeeTnd":${value(homeFee)},"feeConfigured":${homeFee !== null},"maxTravelKm":${value(distance)},"maxTravelDistanceConfigured":${distance !== null}},"cabinet":{"consultationFeeTnd":${value(cabinetFee)},"feeConfigured":${cabinetFee !== null}}}`;
}
