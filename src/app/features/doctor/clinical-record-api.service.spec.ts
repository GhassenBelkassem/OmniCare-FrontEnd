import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ClinicalRecordApiService } from './clinical-record-api.service';
import { EMPTY_CLINICAL_RECORD } from './clinical-record.models';

describe('ClinicalRecordApiService', () => {
  let service: ClinicalRecordApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
    ] });
    service = TestBed.inject(ClinicalRecordApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('serializes the exact prescribed-medication and as-needed follow-up enums', () => {
    const clinicalRecord = {
      ...EMPTY_CLINICAL_RECORD,
      medicationDecision: 'MEDICATION_PRESCRIBED' as const,
      followUp: { required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' as const },
    };

    service.save('consultation-1', 0, clinicalRecord, 'save-key').subscribe();

    const request = http.expectOne('/api/v1/doctor/consultations/consultation-1/clinical-record');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('save-key');
    expect(request.request.body).toEqual({ expectedClinicalRecordVersion: 0, clinicalRecord });
    request.flush({ clinicalRecordVersion: 1, schemaVersion: 2, clinicalRecord });
  });

  it('serializes the exact no-medication and no-follow-up enums', () => {
    const clinicalRecord = {
      ...EMPTY_CLINICAL_RECORD,
      medicationDecision: 'NO_MEDICATION' as const,
      followUp: { required: false, recommendedAt: null, decision: 'NO_FOLLOW_UP' as const },
    };

    service.save('consultation-1', 2, clinicalRecord, 'save-key').subscribe();

    const request = http.expectOne('/api/v1/doctor/consultations/consultation-1/clinical-record');
    expect(request.request.body.clinicalRecord.medicationDecision).toBe('NO_MEDICATION');
    expect(request.request.body.clinicalRecord.followUp).toEqual({
      required: false, recommendedAt: null, decision: 'NO_FOLLOW_UP',
    });
    request.flush({ clinicalRecordVersion: 3, schemaVersion: 2, clinicalRecord });
  });
});
