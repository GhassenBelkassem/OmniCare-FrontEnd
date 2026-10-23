import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { MedicalRecordApiService } from './medical-record-api.service';

describe('MedicalRecordApiService', () => {
  let api: MedicalRecordApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    api = TestBed.inject(MedicalRecordApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads only through the consultation-scoped Spring facade', () => {
    api.getWorkspace('consultation/with spaces').subscribe();

    const request = http.expectOne(
      '/api/v1/doctor/consultations/consultation%2Fwith%20spaces/medical-record',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('mrsPatientId')).toBe(false);
    request.flush({});
  });
});
