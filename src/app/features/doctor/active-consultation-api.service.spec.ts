import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { ActiveConsultationApiService } from './active-consultation-api.service';

describe('ActiveConsultationApiService', () => {
  let api: ActiveConsultationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    api = TestBed.inject(ActiveConsultationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the Spring-owned active consultation contract', () => {
    api.getActive().subscribe((value) => expect(value?.consultationId).toBe('c123'));

    const request = http.expectOne('/api/v1/doctor/consultations/active');
    expect(request.request.method).toBe('GET');
    request.flush({
      consultationId: 'c123',
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-9',
      status: 'IN_PROGRESS',
      medicalAccessStatus: 'NONE',
      version: 3,
      startedAt: '2026-10-22T09:00:00Z',
    });
  });

  it('maps 204 to an empty active state', () => {
    api.getActive().subscribe((value) => expect(value).toBeNull());

    http.expectOne('/api/v1/doctor/consultations/active').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
  });
});
