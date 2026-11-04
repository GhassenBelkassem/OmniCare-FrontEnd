import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicalOrderApiService } from './clinical-order-api.service';

describe('ClinicalOrderApiService', () => {
  let service: ClinicalOrderApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
    ] });
    service = TestBed.inject(ClinicalOrderApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a canonical LAB DRAFT with an idempotency key', () => {
    const definition = {
      requestedExamination: 'Complete blood count — E2E test',
      requestedStudy: null,
      targetSpecialty: null,
    };

    service.create('consultation-1', 'LAB', definition, 'order-save:key').subscribe();

    const request = http.expectOne('/api/v1/doctor/consultations/consultation-1/clinical-orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('order-save:key');
    expect(request.request.body).toEqual({ category: 'LAB', definition });
    request.flush({
      clinicalOrderId: 'order-1',
      consultationId: 'consultation-1',
      category: 'LAB',
      status: 'DRAFT',
      clinicalOrderVersion: 1,
      schemaVersion: 1,
      definition,
    });
  });
});
