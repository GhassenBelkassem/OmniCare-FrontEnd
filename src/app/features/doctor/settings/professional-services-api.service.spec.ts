import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import {
  CareCapabilityApiService,
  MedicalEquipmentApiService,
  PracticeCoverageApiService,
} from './professional-services-api.service';

describe('professional Services API', () => {
  let http: HttpTestingController;
  let capabilities: CareCapabilityApiService;
  let equipment: MedicalEquipmentApiService;
  let coverage: PracticeCoverageApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    capabilities = TestBed.inject(CareCapabilityApiService);
    equipment = TestBed.inject(MedicalEquipmentApiService);
    coverage = TestBed.inject(PracticeCoverageApiService);
  });

  afterEach(() => http.verify());

  it('gets and complete-set replaces care capabilities', () => {
    capabilities.get().subscribe();
    expect(http.expectOne('/api/v1/me/care-capabilities').request.method).toBe('GET');

    capabilities
      .replace({ expectedRevision: 3, capabilities: ['CABINET', 'HOME_VISIT'] })
      .subscribe();
    const request = http.expectOne('/api/v1/me/care-capabilities');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      expectedRevision: 3,
      capabilities: ['CABINET', 'HOME_VISIT'],
    });
  });

  it('uses the overview and mobile replacement endpoints', () => {
    equipment.getOverview().subscribe();
    expect(http.expectOne('/api/v1/me/equipment').request.method).toBe('GET');

    equipment.replaceMobile({ expectedRevision: 4, equipmentCodes: ['PORTABLE_ECG'] }).subscribe();
    const request = http.expectOne('/api/v1/me/equipment/mobile');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedRevision: 4, equipmentCodes: ['PORTABLE_ECG'] });
  });

  it('scopes cabinet equipment requests to the exact cabinet', () => {
    equipment.getPracticeLocation('cabinet-a').subscribe();
    expect(http.expectOne('/api/v1/me/practice-locations/cabinet-a/equipment').request.method).toBe(
      'GET',
    );

    equipment
      .replacePracticeLocation('cabinet-b', { expectedRevision: 7, equipmentCodes: ['ECG'] })
      .subscribe();
    const request = http.expectOne('/api/v1/me/practice-locations/cabinet-b/equipment');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ expectedRevision: 7, equipmentCodes: ['ECG'] });
  });

  it('gets and replaces all coverage declarations for one cabinet', () => {
    coverage.get('cabinet-a').subscribe();
    expect(http.expectOne('/api/v1/me/practice-locations/cabinet-a/coverage').request.method).toBe(
      'GET',
    );

    coverage
      .replace('cabinet-a', {
        expectedRevision: 2,
        cnamAcceptance: 'ACCEPTED',
        privateInsuranceAcceptance: 'NOT_ACCEPTED',
        selfPayAcceptance: 'NOT_DECLARED',
      })
      .subscribe();
    const request = http.expectOne('/api/v1/me/practice-locations/cabinet-a/coverage');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      cnamAcceptance: 'ACCEPTED',
      privateInsuranceAcceptance: 'NOT_ACCEPTED',
      selfPayAcceptance: 'NOT_DECLARED',
    });
  });
});
