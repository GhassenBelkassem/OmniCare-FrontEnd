import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { PrescriptionApiService } from './prescription-api.service';

describe('PrescriptionApiService', () => {
  let service: PrescriptionApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
    ] });
    service = TestBed.inject(PrescriptionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates the initial prescription with version zero and an idempotency key', () => {
    const prescription = {
      medications: [{
        itemId: '22222222-2222-4222-8222-222222222222',
        replacesItemId: null,
        medicationCode: null,
        name: 'Synthetic medicine',
        strength: null,
        dose: { amount: 1, unit: 'mg' },
        route: 'ORAL',
        frequency: { timesPerDay: 1, text: null },
        duration: null,
        quantity: null,
        instructions: null,
      }],
      generalInstructions: null,
    };

    service.save('consultation-1', 0, prescription, 'prescription-save:key').subscribe();

    const request = http.expectOne('/api/v1/doctor/consultations/consultation-1/prescription');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('prescription-save:key');
    expect(request.request.body).toEqual({ expectedPrescriptionVersion: 0, prescription });
    request.flush({
      prescriptionId: 'prescription-1',
      prescriptionVersion: 1,
      clinicalRecordVersion: 2,
      schemaVersion: 2,
      status: 'DRAFT',
      finalized: false,
      signedAt: null,
      signatureAlgorithm: null,
      medicationDecision: 'MEDICATION_PRESCRIBED',
      prescription,
    });
  });
});
