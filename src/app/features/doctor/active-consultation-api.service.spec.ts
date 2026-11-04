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

  it('starts the exact scheduled Appointment with its authoritative version and key', () => {
    api.startScheduled('appointment-9', 7, 'stable-start-key').subscribe();

    const request = http.expectOne('/api/v1/doctor/consultations/start');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('stable-start-key');
    expect(request.request.body).toEqual({
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-9',
      expectedSourceVersion: 7,
    });
    request.flush({
      consultationId: '11111111-1111-4111-8111-111111111111',
      sourceType: 'SCHEDULED_APPOINTMENT',
      sourceId: 'appointment-9',
      status: 'IN_PROGRESS',
      medicalAccessStatus: 'NONE',
      version: 0,
      startedAt: '2026-10-27T10:00:00Z',
    });
  });

  it('uses the completed operational history endpoints', () => {
    api.listCompleted().subscribe((value) => expect(value).toEqual([]));
    const list = http.expectOne('/api/v1/doctor/consultations/completed');
    expect(list.request.method).toBe('GET');
    list.flush([]);

    api.getCompleted('consultation/unsafe').subscribe();
    const detail = http.expectOne(
      '/api/v1/doctor/consultations/completed/consultation%2Funsafe',
    );
    expect(detail.request.method).toBe('GET');
    detail.flush({
      consultation: null,
      historicalMedicalAccessStatus: 'NOT_AUTHORIZED',
      artifactStatusAvailable: true,
      artifacts: [],
    });
  });
});
