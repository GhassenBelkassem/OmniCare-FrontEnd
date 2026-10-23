import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { SecretaryAgendaApiService } from './secretary-agenda-api.service';

describe('SecretaryAgendaApiService', () => {
  let service: SecretaryAgendaApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    service = TestBed.inject(SecretaryAgendaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the agenda for the requested window', () => {
    service.list('2026-08-06').subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/appointments',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-08-06T00:00:00Z');
    expect(request.request.params.get('to')).toBe('2026-08-06T23:59:59.999Z');
    request.flush([]);
  });

  it('requests open slots for the delegating doctor', () => {
    service.listSlots('doctor-1', '2026-08-06').subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/appointments/availability/slots',
    );
    expect(request.request.params.get('doctorId')).toBe('doctor-1');
    request.flush([]);
  });

  it('reschedules through the secretary endpoint with start and end', () => {
    service.reschedule('appt-1', '2026-08-06T10:00:00Z', '2026-08-06T10:30:00Z').subscribe();

    const request = http.expectOne('/api/v1/appointments/appt-1/secretary-reschedule');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      startTime: '2026-08-06T10:00:00Z',
      endTime: '2026-08-06T10:30:00Z',
    });
    request.flush({});
  });

  it('cancels through the secretary endpoint', () => {
    service.cancel('appt-1').subscribe();

    const request = http.expectOne('/api/v1/appointments/appt-1/secretary-cancel');
    expect(request.request.method).toBe('PATCH');
    request.flush({});
  });

  it('sends the bearer token as a secretary', () => {
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'secretary-access-token',
      tokenType: 'Bearer',
      expiresAt: '2999-08-06T12:00:00Z',
      refreshToken: 'secretary-refresh-token',
      refreshExpiresAt: '2999-08-06T23:59:59Z',
      user: { id: 'secretary-1', role: 'SECRETARY', mustChangePassword: false },
    });

    service.list('2026-08-06').subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/appointments');
    expect(request.request.headers.get('Authorization')).toBe('Bearer secretary-access-token');
    request.flush([]);
  });
});