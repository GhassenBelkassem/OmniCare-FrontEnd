import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { PracticePatientApiService } from './practice-patient-api.service';

describe('PracticePatientApiService', () => {
  let service: PracticePatientApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-21T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-08-22T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    service = TestBed.inject(PracticePatientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists patients with search, filter and pagination params', () => {
    service
      .listPatients({ query: 'ben ', filter: 'LINKED', page: 2, size: 20 })
      .subscribe();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/patients' &&
        candidate.params.get('query') === 'ben' &&
        candidate.params.get('filter') === 'LINKED' &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('size') === '20',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ content: [], totalElements: 0 });
  });

  it('omits optional params when not provided', () => {
    service.listPatients().subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/patients');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ content: [], totalElements: 0 });
  });

  it('creates a patient via POST', () => {
    const requestBody = {
      firstName: 'Ahmed',
      lastName: 'Ben Salah',
      dateOfBirth: '1990-04-12',
      sex: 'M' as const,
      phone: '+216 71 234 567',
    };
    service.createPatient(requestBody).subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/patients');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush({
      id: 'patient-1',
      doctorId: 'doctor-1',
      firstName: 'Ahmed',
      lastName: 'Ben Salah',
      dateOfBirth: '1990-04-12',
      sex: 'M',
      phone: '+216 71 234 567',
      email: null,
      address: null,
      source: 'MANUAL',
      linkedOmniCareUserId: null,
      mrsPatientId: 'mrs-1',
      mrsProvisioned: true,
      possibleOmniCareMatch: false,
      createdAt: '2026-08-21T09:00:00Z',
      updatedAt: '2026-08-21T09:00:00Z',
    });
  });

  it('extracts the existing patient id from a duplicate-phone conflict', () => {
    const error = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      url: '/api/v1/patients',
      error: { existingPatientId: 'existing-1' },
    });
    expect(service.duplicateOf(error)).toEqual({ existingPatientId: 'existing-1' });
  });

  it('returns null for non-conflict errors or malformed bodies', () => {
    const badRequest = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      url: '/api/v1/patients',
      error: { code: 'VALIDATION_ERROR', message: 'invalid' },
    });
    expect(service.duplicateOf(badRequest)).toBeNull();

    const malformedConflict = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      url: '/api/v1/patients',
      error: { unknownField: 'nope' },
    });
    expect(service.duplicateOf(malformedConflict)).toBeNull();
  });

  it('links a patient to an OmniCare user via PATCH', () => {
    service.linkToOmniCareUser('patient-1', { omniCareUserId: 'user-7' }).subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/patients/patient-1/link',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ omniCareUserId: 'user-7' });
    request.flush({});
  });
});
